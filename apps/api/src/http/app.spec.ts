import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import { createApp } from './app';
import { createDepsWith, type HttpDeps } from './deps';
import type { Mailer } from '../mail/mailer';
import { RateLimitStore } from './rate-limit-store';
import { resolveClientIp } from './middleware/client-ip';
import { SECURITY_HEADERS } from './middleware/security-headers';
import {
  STRICT_THROTTLE,
  throttle,
  throttleByEmail,
} from './middleware/rate-limit';
import {
  csrfOnMutations,
  rejectDemo,
  requireAuth,
  requireRole,
} from './middleware/auth';
import { jsonBody } from './validate';
import { TokenService } from '../auth/token.service';
import { SESSION_COOKIE } from '../auth/cookie';
import type { DrizzleDB } from '../db/drizzle.constants';
import type { Env } from '../config/env.schema';
import type { AppEnv } from './types';
import { z } from 'zod';

const FRONT = 'http://localhost:4200';
const JWT_SECRET = 's'.repeat(40);

/** Mock Drizzle : `select().from().where().limit()` → `rows`, `execute()` → ok ou panne. */
function fakeDb(rows: Record<string, unknown>[] = [], dbUp = true): DrizzleDB {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  return {
    select: vi.fn().mockReturnValue({ from }),
    execute: dbUp
      ? vi.fn().mockResolvedValue([])
      : vi.fn().mockRejectedValue(new Error('ECONNREFUSED 10.0.0.5:5432')),
  } as unknown as DrizzleDB;
}

function deps(db: DrizzleDB, env: Partial<Env> = {}): HttpDeps {
  const fullEnv = {
    NODE_ENV: 'test',
    CORS_ORIGIN: FRONT,
    JWT_SECRET,
    HEALTH_TOKEN: 'h'.repeat(24),
    ...env,
  } as Env;
  return createDepsWith(fullEnv, db, {} as Mailer);
}

const sessionCookie = async (sv: number, demo = false) =>
  `${SESSION_COOKIE}=${await new TokenService({ JWT_SECRET }).sign({
    sub: 'u1',
    email: 'a@b.c',
    sv,
    ...(demo ? { demo: true as const } : {}),
  })}`;

let d: HttpDeps;
afterEach(() => d?.rateLimits.dispose());

describe('Socle HTTP Hono', () => {
  beforeEach(() => {
    d = deps(fakeDb());
  });

  it('pose les en-têtes de sécurité de Helmet sur une réponse 200, une 404 et une erreur', async () => {
    const app = createApp(d);
    app.get('/boom', () => {
      throw new Error('boom');
    });
    for (const path of ['/health', '/nope', '/boom']) {
      const res = await app.request(path);
      for (const [name, value] of Object.entries(SECURITY_HEADERS))
        expect(res.headers.get(name), `${path} ${name}`).toBe(value);
    }
  });

  it('404 : même corps que Nest, sans compter dans le throttling', async () => {
    const res = await createApp(d).request('/nope?x=1');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({
      statusCode: 404,
      error: 'NOT_FOUND',
      message: 'Cannot GET /nope?x=1',
      path: '/nope?x=1',
    });
    expect(res.headers.get('X-RateLimit-Limit')).toBeNull();
  });

  it('erreur inattendue : 500 générique, aucun détail interne', async () => {
    const app = createApp(d);
    app.get('/boom', () => {
      throw new Error('password=hunter2 at db.ts:42');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await app.request('/boom');
    const body = await res.text();
    expect(res.status).toBe(500);
    expect(body).toContain('Erreur interne du serveur');
    expect(body).not.toContain('hunter2');
  });

  it('même origine : aucune autorisation CORS, ni au preflight ni sur une réponse', async () => {
    const app = createApp(d);
    for (const origin of [FRONT, 'http://evil.test']) {
      const preflight = await app.request('/health', {
        method: 'OPTIONS',
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type,x-csrf-token',
        },
      });
      expect(preflight.headers.get('Access-Control-Allow-Origin')).toBeNull();
      expect(
        preflight.headers.get('Access-Control-Allow-Credentials'),
      ).toBeNull();
      const get = await app.request('/health', { headers: { Origin: origin } });
      expect(get.headers.get('Access-Control-Allow-Origin')).toBeNull();
    }
    const res = await app.request('/health');
    expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
  });

  it('corps JSON > 100 Ko : 413 (et non 500), multipart laissé au plafond de la route', async () => {
    const app = createApp(d);
    app.post('/echo', (c) => c.json({ ok: true }));
    const big = JSON.stringify({ email: 'a'.repeat(200_000) });
    const res = await app.request('/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: big,
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ error: 'PAYLOAD_TOO_LARGE' });

    const form = new FormData();
    form.set('file', new Blob(['x'.repeat(200_000)]));
    const multipart = await app.request('/echo', {
      method: 'POST',
      body: form,
    });
    expect(multipart.status).toBe(200);
  });

  it('JSON illisible : 400 générique, sans recopier le message du parseur', async () => {
    const app = createApp(d);
    app.post('/v', async (c) =>
      c.json(await jsonBody(c, z.object({ email: z.string() }))),
    );
    const json = { 'Content-Type': 'application/json; charset=utf-8' };
    const bad = await app.request('/v', {
      method: 'POST',
      headers: json,
      body: '{bad',
    });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ message: 'Corps JSON invalide' });
    const invalid = await app.request('/v', {
      method: 'POST',
      headers: json,
      body: '{"email":1}',
    });
    expect(invalid.status).toBe(400);
    const ok = await app.request('/v', {
      method: 'POST',
      headers: json,
      body: '{"email":"a@b.c"}',
    });
    expect(await ok.json()).toEqual({ email: 'a@b.c' });
    const empty = await app.request('/v', { method: 'POST', headers: json });
    expect(empty.status).toBe(400); // `{}` validé : email manquant
  });

  it('corps non déclaré application/json ignoré (anti « login CSRF » par formulaire text/plain)', async () => {
    const app = createApp(d);
    app.post('/v', async (c) =>
      c.json(await jsonBody(c, z.object({ email: z.string() }))),
    );
    // Un <form enctype="text/plain"> d'un autre site passe sans preflight CORS.
    const forged = await app.request('/v', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: '{"email":"a@b.c"}',
    });
    expect(forged.status).toBe(400);
  });
});

describe('IP client derrière Traefik', () => {
  it('prend l’entrée la plus à droite de X-Forwarded-For (celle du proxy), pas celle du client', () => {
    expect(resolveClientIp('6.6.6.6, 203.0.113.7', '10.0.0.2')).toBe(
      '203.0.113.7',
    );
    expect(resolveClientIp('203.0.113.7', '10.0.0.2')).toBe('203.0.113.7');
    expect(resolveClientIp(undefined, '::ffff:127.0.0.1')).toBe(
      '::ffff:127.0.0.1',
    );
    expect(resolveClientIp(' , ', undefined)).toBe('unknown');
  });

  it('un X-Forwarded-For forgé ne donne pas un compteur neuf à chaque requête', async () => {
    d = deps(fakeDb());
    const app = createApp(d);
    app.post('/login', throttle({ limit: 2, ttlMs: 60_000 }), (c) =>
      c.json({}),
    );
    const hit = (spoof: string) =>
      app.request('/login', {
        method: 'POST',
        // Traefik ajoute l'IP réelle à droite de ce que le client a envoyé.
        headers: { 'X-Forwarded-For': `${spoof}, 203.0.113.7` },
      });
    expect((await hit('1.1.1.1')).status).toBe(200);
    expect((await hit('2.2.2.2')).status).toBe(200);
    expect((await hit('3.3.3.3')).status).toBe(429);
  });
});

describe('Throttling', () => {
  beforeEach(() => {
    d = deps(fakeDb());
  });

  it('route ordinaire : en-têtes X-RateLimit-* de la règle par défaut (1000 / 15 min)', async () => {
    const res = await createApp(d).request('/health');
    expect(res.headers.get('X-RateLimit-Limit')).toBe('1000');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('999');
    expect(res.headers.get('X-RateLimit-Reset')).toBe('900');
  });

  it('route stricte : 10 passent, la 11e reçoit 429 + Retry-After, sans toucher les autres routes', async () => {
    const app = createApp(d);
    app.post('/strict', throttle(STRICT_THROTTLE), (c) => c.json({}));
    for (let i = 0; i < 10; i++)
      expect((await app.request('/strict', { method: 'POST' })).status).toBe(
        200,
      );
    const blocked = await app.request('/strict', { method: 'POST' });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBe('900');
    expect(await blocked.json()).toMatchObject({
      statusCode: 429,
      error: 'TOO_MANY_REQUESTS',
      message: 'ThrottlerException: Too Many Requests',
    });
    expect((await app.request('/health')).status).toBe(200);
  });

  it('second compteur par e-mail : bloque un compte visé depuis plusieurs IP', async () => {
    const app = createApp(d);
    const rule = { limit: 2, ttlMs: 60_000 };
    app.post(
      '/verify',
      throttle(rule),
      throttleByEmail(d.rateLimits, rule),
      (c) => c.json({}),
    );
    const from = (ip: string, email: string) =>
      app.request('/verify', {
        method: 'POST',
        headers: { 'X-Forwarded-For': ip, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    expect((await from('1.1.1.1', 'Victim@x.test')).status).toBe(200);
    expect((await from('2.2.2.2', 'victim@x.test ')).status).toBe(200);
    expect((await from('3.3.3.3', 'victim@x.test')).status).toBe(429);
    expect((await from('4.4.4.4', 'other@x.test')).status).toBe(200);
  });
});

describe('RateLimitStore', () => {
  it('fenêtre glissante, blocage pour toute sa durée puis remise à zéro', () => {
    let now = 0;
    const store = new RateLimitStore(() => now);
    const rule = { limit: 2, ttlMs: 1000, blockMs: 5000 };
    expect(store.increment('k', rule).isBlocked).toBe(false);
    expect(store.increment('k', rule).isBlocked).toBe(false);
    expect(store.increment('k', rule)).toMatchObject({
      isBlocked: true,
      timeToBlockExpire: 5,
    });
    now = 4000; // les coups ont expiré, mais le blocage dure encore
    expect(store.increment('k', rule).isBlocked).toBe(true);
    now = 5000;
    expect(store.increment('k', rule)).toMatchObject({
      isBlocked: false,
      totalHits: 1,
    });
    // Une autre clé n'est jamais affectée par la levée du blocage.
    expect(store.increment('other', rule).totalHits).toBe(1);
    store.dispose();
  });
});

describe('Authentification, CSRF, démo, rôle', () => {
  function protectedApp(db: DrizzleDB) {
    d = deps(db);
    const app = createApp(d);
    const routes = new Hono<AppEnv>()
      .use(requireAuth(d.sessions), csrfOnMutations(d.csrfPolicy))
      .get('/me', (c) => c.json(c.get('user')))
      .post('/mutate', (c) => c.json({ ok: true }))
      .post('/no-demo', rejectDemo(), (c) => c.json({ ok: true }))
      .get('/admin', requireRole(d.roles, 'admin'), (c) =>
        c.json({ ok: true }),
      );
    app.route('/t', routes);
    return app;
  }

  it('401 sans cookie, cookie illisible ou session révoquée (messages de JwtAuthGuard)', async () => {
    const app = protectedApp(fakeDb([{ sessionVersion: 2 }]));
    const msg = async (cookie?: string) =>
      (await (
        await app.request('/t/me', {
          headers: cookie ? { Cookie: cookie } : {},
        })
      ).json()) as {
        statusCode: number;
        message: string;
      };
    expect(await msg()).toMatchObject({
      statusCode: 401,
      message: 'Non authentifié',
    });
    expect(await msg(`${SESSION_COOKIE}=abc`)).toMatchObject({
      statusCode: 401,
      message: 'Session invalide',
    });
    expect(await msg(await sessionCookie(1))).toMatchObject({
      statusCode: 401,
      message: 'Session révoquée',
    });
  });

  it('session valide : user attaché ; mutation refusée sans jeton CSRF ou depuis une autre origine', async () => {
    const app = protectedApp(fakeDb([{ sessionVersion: 2, role: 'user' }]));
    const Cookie = await sessionCookie(2);
    const me = await app.request('/t/me', { headers: { Cookie } });
    expect(await me.json()).toEqual({
      id: 'u1',
      email: 'a@b.c',
      sessionVersion: 2,
      isDemo: false,
    });

    const token = d.csrf.tokenFor('u1', 2);
    const post = (headers: Record<string, string>) =>
      app.request('/t/mutate', {
        method: 'POST',
        headers: { Cookie, ...headers },
      });
    expect((await post({ Origin: FRONT })).status).toBe(403);
    expect(
      (await post({ Origin: 'http://evil.test', 'X-CSRF-Token': token }))
        .status,
    ).toBe(403);
    expect(
      (await post({ Origin: FRONT, 'X-CSRF-Token': d.csrf.tokenFor('u1', 1) }))
        .status,
    ).toBe(403);
    expect((await post({ Origin: FRONT, 'X-CSRF-Token': token })).status).toBe(
      200,
    );
  });

  it('compte démo refusé sur les routes marquées ; rôle admin exigé', async () => {
    const app = protectedApp(fakeDb([{ sessionVersion: 2, role: 'user' }]));
    const demo = await sessionCookie(2, true);
    const token = d.csrf.tokenFor('u1', 2);
    const res = await app.request('/t/no-demo', {
      method: 'POST',
      headers: { Cookie: demo, Origin: FRONT, 'X-CSRF-Token': token },
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      message: 'Action indisponible sur le compte démo',
    });

    const admin = await app.request('/t/admin', {
      headers: { Cookie: await sessionCookie(2) },
    });
    expect(admin.status).toBe(403);
    expect(await admin.json()).toMatchObject({ message: 'Accès réservé' });
  });

  it('production : mutation sans Origin ni Referer refusée', async () => {
    const db = fakeDb([{ sessionVersion: 2 }]);
    d = deps(db, { NODE_ENV: 'production' });
    const app = createApp(d);
    app.route(
      '/t',
      new Hono<AppEnv>()
        .use(requireAuth(d.sessions), csrfOnMutations(d.csrfPolicy))
        .post('/mutate', (c) => c.json({})),
    );
    const res = await app.request('/t/mutate', {
      method: 'POST',
      headers: {
        Cookie: await sessionCookie(2),
        'X-CSRF-Token': d.csrf.tokenFor('u1', 2),
      },
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ message: 'Origine manquante' });
  });
});

describe('Health', () => {
  it('/health public ; /ready : 404 sans le bon jeton, 503 base injoignable sans détail', async () => {
    d = deps(fakeDb([], false));
    const app = createApp(d);
    expect(await (await app.request('/health')).json()).toEqual({ ok: true });
    expect((await app.request('/health/ready')).status).toBe(404);
    expect(
      (
        await app.request('/health/ready', {
          headers: { 'x-health-token': 'x'.repeat(24) },
        })
      ).status,
    ).toBe(404);
    const down = await app.request('/health/ready', {
      headers: { 'x-health-token': 'h'.repeat(24) },
    });
    expect(down.status).toBe(503);
    expect(await down.text()).not.toContain('10.0.0.5');
  });
});
