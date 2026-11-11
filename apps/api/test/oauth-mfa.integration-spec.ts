import { describe, it, expect, afterAll, vi } from 'vitest';
// DATABASE_URL est injectée par vitest.integration.config.ts → test.env
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as OTPAuth from 'otpauth';
import * as schema from '../src/db/schema';
import { createApp } from '../src/http/app';
import { createDepsWith } from '../src/http/deps';
import { envSchema } from '../src/config/env.schema';
import { OAUTH_MFA_COOKIE, SESSION_COOKIE } from '../src/auth/cookie';
import { SecretCipherService } from '../src/auth/secret-cipher.service';
import { TwoFactorService } from '../src/auth/two-factor.service';
import type { Mailer } from '../src/mail/mailer';

/**
 * Retour Google sur un compte protégé par la 2FA, contre une vraie base : vrai rattachement par
 * e-mail, vraie session, vrai anti-rejeu, vrais codes de secours. Seul l'appel à Google est doublé.
 */
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL requise pour les tests');
const sql = postgres(databaseUrl);
const db = drizzle(sql, { schema });
const env = envSchema.parse({
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
  JWT_SECRET: 'integration-oauth-mfa-secret-at-least-32-chars',
  CORS_ORIGIN: 'http://localhost:4200',
});
const FRONT = 'http://localhost:4200';
const cipher = new SecretCipherService(env);
const twoFactor = new TwoFactorService();
const BACKUP_CODE = 'abcde-fghjk';

let seq = 0;
const uniqueEmail = (): string =>
  `oauth-mfa+${process.pid}-${Date.now()}-${seq++}@dashflow.test`;

/** Compte vérifié à mot de passe, jamais relié à Google. Avec 2FA (et un code de secours) si demandé. */
async function makeAccount(opts: { totp: boolean }) {
  const email = uniqueEmail();
  const { secret } = twoFactor.generateSecret(email);
  const [user] = await db
    .insert(schema.users)
    .values({
      email,
      password: 'hash-jamais-présenté',
      authVersion: 1,
      emailVerified: new Date(),
      ...(opts.totp
        ? { totpSecret: cipher.encrypt(secret), totpEnabled: new Date() }
        : {}),
    })
    .returning();
  if (opts.totp)
    await db
      .insert(schema.totpBackupCodes)
      .values({ userId: user.id, codeHash: cipher.hmac(BACKUP_CODE) });
  const authenticator = new OTPAuth.TOTP({
    issuer: 'DashFlow',
    label: email,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return { user, authenticator };
}

/** App Hono complète sur la vraie base ; Google répond pour `email`. Compteurs de throttling neufs. */
function appFor(email: string) {
  const deps = createDepsWith(env, db, {} as Mailer);
  vi.spyOn(deps.oauth, 'fetchGoogleUser').mockResolvedValue({
    googleId: `google-${email}`,
    email,
    displayName: 'Alice',
  });
  const app = createApp(deps);
  return {
    callback: () =>
      app.request('/auth/oauth/google/callback?code=c&state=etat', {
        headers: {
          Cookie: 'dashflow_oauth_state=etat; dashflow_oauth_verifier=v',
        },
      }),
    mfa: (cookie: string, totpCode: string) =>
      app.request('/auth/oauth/google/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ totpCode }),
      }),
    me: (cookie: string) =>
      app.request('/auth/me', { headers: { Cookie: cookie } }),
    dispose: () => deps.rateLimits.dispose(),
  };
}

/** Ce que le navigateur renverrait après cette réponse : cookies posés et non vidés. */
function cookieHeader(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0] ?? '')
    .filter((pair) => !pair.endsWith('='))
    .join('; ');
}

const eventsOf = async (userId: string): Promise<string[]> =>
  (
    await db
      .select({ type: schema.securityEvents.type })
      .from(schema.securityEvents)
      .where(eq(schema.securityEvents.userId, userId))
  )
    .map((e) => e.type)
    .sort();

const userRow = async (id: string) =>
  (await db.select().from(schema.users).where(eq(schema.users.id, id)))[0];

describe('Connexion Google sur un compte 2FA (intégration DB)', () => {
  afterAll(async () => {
    await sql.end();
  });

  it('Google seul n’ouvre pas un compte mot de passe + TOTP : pas de session, rien au journal', async () => {
    const { user } = await makeAccount({ totp: true });
    const api = appFor(user.email);

    const res = await api.callback();

    expect(res.headers.get('location')).toBe(`${FRONT}/auth/login?oauth=mfa`);
    const cookies = cookieHeader(res);
    expect(cookies).toContain(`${OAUTH_MFA_COOKIE}=`);
    expect(cookies).not.toContain(`${SESSION_COOKIE}=`);
    expect((await api.me(cookies)).status).toBe(401);
    expect(await eventsOf(user.id)).toEqual([]);
    api.dispose();
  });

  it('la preuve suivie d’un code TOTP valide ouvre la session ; le même code ne la rouvre pas', async () => {
    const { user, authenticator } = await makeAccount({ totp: true });
    const api = appFor(user.email);
    const pending = cookieHeader(await api.callback());
    const code = authenticator.generate();

    const opened = await api.mfa(pending, code);
    const replay = await api.mfa(pending, code);

    expect(opened.status).toBe(200);
    const me = await api.me(cookieHeader(opened));
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({
      id: user.id,
      totpEnabled: true,
      googleLinked: true,
    });
    expect(replay.status).toBe(401);
    expect(cookieHeader(replay)).toBe('');
    expect((await userRow(user.id))?.totpLastUsedStep).toEqual(
      expect.any(Number),
    );
    expect(await eventsOf(user.id)).toEqual(['login_failed', 'login_oauth']);
    api.dispose();
  });

  it('un code faux n’ouvre rien et laisse le compte fermé', async () => {
    const { user, authenticator } = await makeAccount({ totp: true });
    const api = appFor(user.email);
    const pending = cookieHeader(await api.callback());
    const wrong = authenticator.generate() === '000000' ? '111111' : '000000';

    const res = await api.mfa(pending, wrong);

    expect(res.status).toBe(401);
    expect((await api.me(cookieHeader(res))).status).toBe(401);
    expect((await userRow(user.id))?.totpLastUsedStep).toBeNull();
    expect(await eventsOf(user.id)).toEqual(['login_failed']);
    api.dispose();
  });

  it('un code de secours ouvre la session une seule fois (consommé en base)', async () => {
    const { user } = await makeAccount({ totp: true });
    const api = appFor(user.email);
    const pending = cookieHeader(await api.callback());

    const opened = await api.mfa(pending, BACKUP_CODE);
    const reused = await api.mfa(pending, BACKUP_CODE);

    expect(opened.status).toBe(200);
    expect(await opened.json()).toEqual({
      message: 'Connecté',
      backupCodesRemaining: 0,
    });
    expect((await api.me(cookieHeader(opened))).status).toBe(200);
    expect(reused.status).toBe(401);
    expect(await eventsOf(user.id)).toEqual([
      'backup_code_used',
      'login_failed',
      'login_oauth',
    ]);
    api.dispose();
  });

  it('la preuve ne survit pas à une révocation de session (version incrémentée en base)', async () => {
    const { user, authenticator } = await makeAccount({ totp: true });
    const api = appFor(user.email);
    const pending = cookieHeader(await api.callback());
    await db
      .update(schema.users)
      .set({ sessionVersion: user.sessionVersion + 1 })
      .where(eq(schema.users.id, user.id));

    const res = await api.mfa(pending, authenticator.generate());

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: 'MFA_PROOF_REJECTED' });
    expect(cookieHeader(res)).toBe('');
    api.dispose();
  });

  it('compte sans 2FA : Google ouvre toujours la session directement', async () => {
    const { user } = await makeAccount({ totp: false });
    const api = appFor(user.email);

    const res = await api.callback();

    expect(res.headers.get('location')).toBe(
      `${FRONT}/auth/login?oauth=success`,
    );
    const me = await api.me(cookieHeader(res));
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ id: user.id, totpEnabled: false });
    expect(await eventsOf(user.id)).toEqual(['login_oauth']);
    api.dispose();
  });
});
