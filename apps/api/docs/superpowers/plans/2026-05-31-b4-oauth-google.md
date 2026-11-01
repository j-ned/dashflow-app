# OAuth Google (B4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Porter l'OAuth Google (arctic + PKCE) en NestJS, adapté à l'auth cookie (state en cookies, callback qui pose le cookie de session).

**Architecture:** `OAuthService` (arctic Google + findOrCreate) + `OAuthController` (`/auth/oauth/google` + callback). State/verifier en cookies httpOnly courts ; callback pose le cookie de session via `TokenService` et redirige le front sans token dans l'URL.

**Tech Stack:** NestJS, arctic, Drizzle, Zod, Vitest.

> ⚠️ J-Ned : commits locaux, **jamais de push**. Cwd : `/home/jned/WebstormProjects/DashFlow/nest-dashflow-app/`. DB up pour l'e2e.
> Contexte : `AuthRepository` (`findByEmail`, `findById`, `updateUser`, `createUser`), `TokenService.sign({sub,email})`, `cookie.ts` (`SESSION_COOKIE`, `sessionCookieOptions`), `auth.module.ts`, `ConfigService<Env,true>`, schéma `users` (`googleId`, `emailVerified`).

---

## File Structure

| Fichier | Action |
|---|---|
| `package.json` | + arctic |
| `src/config/env.schema.ts` | + GOOGLE_CLIENT_ID/SECRET (optionnels), APP_URL (défaut) |
| `.env.example` / `.env` | + ces variables |
| `src/auth/cookie.ts` | + OAUTH_STATE_COOKIE / OAUTH_VERIFIER_COOKIE + `oauthCookieOptions` |
| `src/auth/auth.repository.ts` | + `findByGoogleId` |
| `src/auth/oauth.service.ts` | nouveau : arctic + findOrCreate |
| `src/auth/oauth.service.spec.ts` | unit |
| `src/auth/oauth.controller.ts` | nouveau : init + callback |
| `src/auth/auth.module.ts` | + OAuthService + OAuthController |
| `test/oauth.e2e-spec.ts` | init redirect 302 |

---

## Task 1: Dep + env + cookie helpers + findByGoogleId

**Files:** Modify `package.json`, `src/config/env.schema.ts`, `.env.example`/`.env`, `src/auth/cookie.ts`, `src/auth/auth.repository.ts`

- [ ] **Step 1:** `pnpm add arctic@^3.7.0`

- [ ] **Step 2:** Dans `src/config/env.schema.ts`, ajouter au `z.object` :
```ts
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  APP_URL: z.string().url().default('http://localhost:3001'),
```

- [ ] **Step 3:** Append `.env.example` et `.env` :
```dotenv
APP_URL=http://localhost:3001
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```
(⚠️ valeurs vides → `z.string().optional()` doit tolérer la chaîne vide : si Zod rejette `''`, utiliser `.optional().transform(v => v || undefined)` ou laisser les lignes commentées dans `.env`. Choisir de **commenter** ces 2 lignes dans `.env` pour rester `undefined`.)

- [ ] **Step 4:** Dans `src/auth/cookie.ts`, ajouter :
```ts
export const OAUTH_STATE_COOKIE = 'dashflow_oauth_state';
export const OAUTH_VERIFIER_COOKIE = 'dashflow_oauth_verifier';

export function oauthCookieOptions(isProd: boolean): CookieOptions {
  return { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: 600_000 };
}
```

- [ ] **Step 5:** Dans `src/auth/auth.repository.ts`, ajouter la méthode :
```ts
  findByGoogleId(googleId: string): Promise<User | undefined> {
    return this.db.select().from(users).where(eq(users.googleId, googleId)).limit(1).then((r) => r[0]);
  }
```

- [ ] **Step 6:** `pnpm tsc --noEmit` clean + `pnpm test` (rien cassé ; app doit toujours booter — env GOOGLE_* undefined OK).

- [ ] **Step 7: Commit** — `feat(b4): dep arctic + env OAuth + cookie helpers + findByGoogleId`

---

## Task 2: OAuthService (TDD)

**Files:** Create `src/auth/oauth.service.ts`, `src/auth/oauth.service.spec.ts`

- [ ] **Step 1: Test** `src/auth/oauth.service.spec.ts` :
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OAuthService } from './oauth.service';

const config = (id?: string) => ({ get: vi.fn((k: string) => ({ GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: id ? 'secret' : undefined, APP_URL: 'http://localhost:3001' } as any)[k]) });
const repo = () => ({ findByGoogleId: vi.fn(), findByEmail: vi.fn(), updateUser: vi.fn(), createUser: vi.fn() });

describe('OAuthService', () => {
  let r: ReturnType<typeof repo>;
  beforeEach(() => { r = repo(); });

  it('createAuthorization : URL Google + state + verifier', () => {
    const svc = new OAuthService(config('cid') as any, r as any);
    const { url, state, codeVerifier } = svc.createAuthorization();
    expect(url).toContain('accounts.google.com');
    expect(state.length).toBeGreaterThan(0);
    expect(codeVerifier.length).toBeGreaterThan(0);
  });

  it('createAuthorization : lance si non configuré', () => {
    const svc = new OAuthService(config(undefined) as any, r as any);
    expect(() => svc.createAuthorization()).toThrow();
  });

  it('findOrCreate : googleId existant → renvoie le user', async () => {
    const svc = new OAuthService(config('cid') as any, r as any);
    r.findByGoogleId.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    const user = await svc.findOrCreateGoogleUser({ googleId: 'g1', email: 'a@b.com', displayName: 'A' });
    expect(user.id).toBe('u1');
    expect(r.createUser).not.toHaveBeenCalled();
  });

  it('findOrCreate : email existant sans googleId → lien', async () => {
    const svc = new OAuthService(config('cid') as any, r as any);
    r.findByGoogleId.mockResolvedValue(undefined);
    r.findByEmail.mockResolvedValue({ id: 'u2', email: 'a@b.com', emailVerified: null });
    r.updateUser.mockResolvedValue({ id: 'u2', email: 'a@b.com' });
    await svc.findOrCreateGoogleUser({ googleId: 'g1', email: 'a@b.com', displayName: 'A' });
    expect(r.updateUser).toHaveBeenCalledWith('u2', expect.objectContaining({ googleId: 'g1', emailVerified: expect.any(Date) }));
  });

  it('findOrCreate : inconnu → création sans password', async () => {
    const svc = new OAuthService(config('cid') as any, r as any);
    r.findByGoogleId.mockResolvedValue(undefined);
    r.findByEmail.mockResolvedValue(undefined);
    r.createUser.mockResolvedValue({ id: 'u3', email: 'a@b.com' });
    await svc.findOrCreateGoogleUser({ googleId: 'g1', email: 'a@b.com', displayName: 'A' });
    const arg = r.createUser.mock.calls[0][0];
    expect(arg.password).toBeNull();
    expect(arg.googleId).toBe('g1');
  });
});
```

- [ ] **Step 2:** Run → FAIL.

- [ ] **Step 3:** `src/auth/oauth.service.ts` :
```ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Google, generateState, generateCodeVerifier } from 'arctic';
import { AuthRepository } from './auth.repository';
import type { Env } from '../config/env.schema';
import type { users } from '../db/schema';

type User = typeof users.$inferSelect;
export interface GoogleProfile { googleId: string; email: string; displayName: string }

@Injectable()
export class OAuthService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly repo: AuthRepository,
  ) {}

  private google(): Google {
    const clientId = this.config.get('GOOGLE_CLIENT_ID', { infer: true });
    const clientSecret = this.config.get('GOOGLE_CLIENT_SECRET', { infer: true });
    if (!clientId || !clientSecret) throw new InternalServerErrorException('Google OAuth non configuré');
    const redirectUri = `${this.config.get('APP_URL', { infer: true })}/api/auth/oauth/google/callback`;
    return new Google(clientId, clientSecret, redirectUri);
  }

  createAuthorization(): { url: string; state: string; codeVerifier: string } {
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const url = this.google().createAuthorizationURL(state, codeVerifier, ['openid', 'email', 'profile']);
    return { url: url.toString(), state, codeVerifier };
  }

  async fetchGoogleUser(code: string, codeVerifier: string): Promise<GoogleProfile> {
    const tokens = await this.google().validateAuthorizationCode(code, codeVerifier);
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.accessToken()}` },
    });
    const p = (await res.json()) as { id: string; email?: string; name?: string };
    if (!p.email) throw new Error('oauth_no_email');
    return { googleId: p.id, email: p.email.toLowerCase(), displayName: p.name ?? p.email.split('@')[0] };
  }

  async findOrCreateGoogleUser(profile: GoogleProfile): Promise<User> {
    const byGoogle = await this.repo.findByGoogleId(profile.googleId);
    if (byGoogle) return byGoogle;
    const byEmail = await this.repo.findByEmail(profile.email);
    if (byEmail) {
      return this.repo.updateUser(byEmail.id, { googleId: profile.googleId, emailVerified: byEmail.emailVerified ?? new Date() });
    }
    return this.repo.createUser({ email: profile.email, password: null, displayName: profile.displayName }).then((u) =>
      this.repo.updateUser(u.id, { googleId: profile.googleId, emailVerified: new Date() }),
    );
  }
}
```
> Note : `createUser` (B1) ne pose pas `googleId`/`emailVerified` → on enchaîne un `updateUser` pour les fixer (2 requêtes ; acceptable, évite d'élargir la signature de `createUser`).

- [ ] **Step 4:** Run → PASS. **Step 5: Commit** — `feat(b4): OAuthService (arctic + findOrCreateGoogleUser)`

---

## Task 3: OAuthController + wiring

**Files:** Create `src/auth/oauth.controller.ts`; Modify `src/auth/auth.module.ts`

- [ ] **Step 1:** `src/auth/oauth.controller.ts` :
```ts
import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { OAuthService } from './oauth.service';
import { TokenService } from './token.service';
import {
  SESSION_COOKIE, OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE,
  sessionCookieOptions, oauthCookieOptions,
} from './cookie';
import type { Env } from '../config/env.schema';

@Controller('auth/oauth/google')
export class OAuthController {
  private readonly isProd: boolean;
  private readonly frontUrl: string;
  constructor(
    private readonly oauth: OAuthService,
    private readonly token: TokenService,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.isProd = config.get('NODE_ENV', { infer: true }) === 'production';
    this.frontUrl = config.get('CORS_ORIGIN', { infer: true }).split(',')[0];
  }

  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @Get()
  start(@Res({ passthrough: true }) res: Response) {
    const { url, state, codeVerifier } = this.oauth.createAuthorization();
    res.cookie(OAUTH_STATE_COOKIE, state, oauthCookieOptions(this.isProd));
    res.cookie(OAUTH_VERIFIER_COOKIE, codeVerifier, oauthCookieOptions(this.isProd));
    res.redirect(url);
  }

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const cookies = (req.cookies ?? {}) as Record<string, string>;
    const cookieState = cookies[OAUTH_STATE_COOKIE];
    const codeVerifier = cookies[OAUTH_VERIFIER_COOKIE];
    res.clearCookie(OAUTH_STATE_COOKIE, oauthCookieOptions(this.isProd));
    res.clearCookie(OAUTH_VERIFIER_COOKIE, oauthCookieOptions(this.isProd));

    if (!code || !state || !cookieState || !codeVerifier || state !== cookieState) {
      res.redirect(`${this.frontUrl}/auth/login?error=oauth_expired`);
      return;
    }
    try {
      const profile = await this.oauth.fetchGoogleUser(code, codeVerifier);
      const user = await this.oauth.findOrCreateGoogleUser(profile);
      const jwt = await this.token.sign({ sub: user.id, email: user.email });
      res.cookie(SESSION_COOKIE, jwt, sessionCookieOptions(this.isProd));
      res.redirect(`${this.frontUrl}/auth/login?oauth=success`);
    } catch (err) {
      const reason = err instanceof Error && err.message === 'oauth_no_email' ? 'oauth_no_email' : 'oauth_failed';
      res.redirect(`${this.frontUrl}/auth/login?error=${reason}`);
    }
  }
}
```
> `@Res()` sans `passthrough` sur le callback car on gère la réponse (redirects) entièrement à la main.

- [ ] **Step 2:** Dans `src/auth/auth.module.ts` : importer `OAuthService` + `OAuthController` ; ajouter `OAuthController` aux `controllers`, `OAuthService` aux `providers`. (`TokenService` est déjà fourni.)

- [ ] **Step 3:** `pnpm test` + `pnpm tsc --noEmit` clean. Boot smoke (DB up) : démarrer `pnpm start:dev`, vérifier les routes `/api/auth/oauth/google` + `/api/auth/oauth/google/callback` mappées + "successfully started", puis **tuer le serveur** (`pkill -f "cli/bin/nest.js start"`).

- [ ] **Step 4: Commit** — `feat(b4): OAuthController (init + callback cookie) + wiring`

---

## Task 4: e2e init redirect

**Files:** Create `test/oauth.e2e-spec.ts`

> Le test configure des creds Google factices via `overrideProvider(ConfigService)`? Plus simple : injecter les vars dans l'env du run e2e. Le `vitest.e2e.config.ts` charge `.env` ; on **set** `GOOGLE_CLIENT_ID`/`SECRET` directement dans le test via `process.env` avant de construire l'app (suffit pour `createAuthorizationURL`, qui ne contacte pas Google).

- [ ] **Step 1:** `test/oauth.e2e-spec.ts` :
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';

describe('OAuth e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('GET /api/auth/oauth/google → 302 vers Google + cookies state/verifier', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/oauth/google').expect(302);
    expect(res.headers.location).toContain('accounts.google.com');
    const setCookie = (res.headers['set-cookie'] as unknown as string[]).join(';');
    expect(setCookie).toContain('dashflow_oauth_state');
    expect(setCookie).toContain('dashflow_oauth_verifier');
  });
});
```
> `process.env.GOOGLE_*` est posé AVANT l'import dynamique d'`AppModule` pour que la validation Zod de la config les voie. (Le `validate` parse `process.env` au boot.)

- [ ] **Step 2:** Run `pnpm test:e2e` → tous PASS (auth + oauth). **Step 3: Commit** — `test(b4): e2e init OAuth (302 + cookies)`

---

## Self-Review

**Couverture du spec :**
- arctic + PKCE → Task 2 ✓
- state/verifier en cookies httpOnly courts → Tasks 1 (helpers), 3 (pose/lecture) ✓
- callback pose cookie session + redirect sans token → Task 3 ✓
- findOrCreateGoogleUser 3 branches → Task 2 ✓
- env GOOGLE_* optionnels + APP_URL → Task 1 ✓
- erreurs oauth_expired/no_email/failed → Task 3 ✓
- findByGoogleId → Task 1 ✓
- tests unit + e2e (critères 1-5) → Tasks 2, 4 ✓
- app boote sans GOOGLE_* → Task 1 step 6 ✓

**Placeholders :** aucun. Note `.env` (lignes GOOGLE_* commentées) explicite pour rester `undefined`.

**Cohérence des types :** `GoogleProfile` (Task 2) utilisé Task 3. `OAuthService(config, repo)` cohérent (spec Task 2 + module Task 3). `findByGoogleId` (Task 1) utilisé Task 2. Cookies `OAUTH_STATE_COOKIE`/`OAUTH_VERIFIER_COOKIE`/`oauthCookieOptions` (Task 1) utilisés Task 3. `TokenService.sign` + `sessionCookieOptions` réutilisés (B1) Task 3. Front redirect `CORS_ORIGIN.split(',')[0]`.
