import type { Hono } from 'hono';
import { createApp } from '../../src/http/app';
import { createDepsWith, type HttpDeps } from '../../src/http/deps';
import type { AppEnv } from '../../src/http/types';
import { TokenService } from '../../src/auth/token.service';
import { CsrfService } from '../../src/auth/csrf.service';
import { SESSION_COOKIE } from '../../src/auth/cookie';
import type { DrizzleDB } from '../../src/db/drizzle.constants';
import type { Env } from '../../src/config/env.schema';
import type { Mailer } from '../../src/mail/mailer';

/**
 * Application Hono complète (vrais middlewares : sécurité, throttling, session, CSRF) pour les
 * specs de routes, avec des services remplacés au besoin. Seules la session et le rôle lisent la
 * base : une base factice leur répond.
 */
export const FRONT_ORIGIN = 'http://localhost:4200';
const JWT_SECRET = 't'.repeat(40);

export const TEST_ENV = {
  NODE_ENV: 'test',
  CORS_ORIGIN: FRONT_ORIGIN,
  JWT_SECRET,
  APP_URL: 'http://localhost:3001',
  HEALTH_TOKEN: 'h'.repeat(24),
  DEMO_ENABLED: true,
  MAILER: 'console',
  S3_REGION: 'auto',
} as Env;

export type TestUser = {
  id: string;
  email: string;
  sessionVersion: number;
  role?: 'user' | 'admin';
  demo?: boolean;
};

export const TEST_USER: TestUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'user@dashflow.test',
  sessionVersion: 1,
};

/** Répond `[{ sessionVersion, role }]` à toute lecture `select().from().where().limit()`. */
function sessionDb(user: TestUser): DrizzleDB {
  const rows = [
    { sessionVersion: user.sessionVersion, role: user.role ?? 'user' },
  ];
  const chain = { limit: () => Promise.resolve(rows) };
  return {
    select: () => ({ from: () => ({ where: () => chain }) }),
  } as unknown as DrizzleDB;
}

export type HonoTestApp = {
  app: Hono<AppEnv>;
  deps: HttpDeps;
  /** Requête authentifiée : cookie de session, Origin du front et jeton CSRF posés. */
  authed(path: string, init?: RequestInit): Promise<Response>;
  /** Requête sans aucun en-tête d'authentification. */
  anonymous(path: string, init?: RequestInit): Promise<Response>;
};

export async function honoTestApp(
  overrides: Partial<HttpDeps> = {},
  user: TestUser = TEST_USER,
): Promise<HonoTestApp> {
  const base = createDepsWith(TEST_ENV, sessionDb(user), {} as Mailer);
  const deps = { ...base, ...overrides };
  const app = createApp(deps);
  const jwt = await new TokenService(TEST_ENV).sign({
    sub: user.id,
    email: user.email,
    sv: user.sessionVersion,
    ...(user.demo ? { demo: true as const } : {}),
  });
  const csrf = new CsrfService(TEST_ENV).tokenFor(user.id, user.sessionVersion);
  return {
    app,
    deps,
    authed: (path, init = {}) => {
      const headers = new Headers(init.headers);
      headers.set('Cookie', `${SESSION_COOKIE}=${jwt}`);
      if (!headers.has('Origin')) headers.set('Origin', FRONT_ORIGIN);
      if (!headers.has('X-CSRF-Token')) headers.set('X-CSRF-Token', csrf);
      return Promise.resolve(app.request(path, { ...init, headers }));
    },
    anonymous: (path, init) => Promise.resolve(app.request(path, init)),
  };
}

/** Corps JSON déclaré `application/json`. */
export const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** Corps multipart avec un fichier `field` (et des champs texte facultatifs). */
export function multipartInit(
  field: string,
  bytes: Buffer,
  type: string,
  fields: Record<string, string> = {},
): RequestInit {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append(field, new Blob([new Uint8Array(bytes)], { type }), 'upload.bin');
  return { method: 'POST', body: form };
}
