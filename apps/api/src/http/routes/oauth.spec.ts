import { describe, it, expect, vi, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import * as OTPAuth from 'otpauth';
import {
  FRONT_ORIGIN,
  honoTestApp,
  jsonInit,
  TEST_ENV,
  TEST_USER,
} from '../../../test/support/hono-test-app';
import {
  OAUTH_MFA_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  SESSION_COOKIE,
} from '../../auth/cookie';
import { AuthService } from '../../auth/auth.service';
import type { AuthRepository } from '../../auth/auth.repository';
import type { OAuthService } from '../../auth/oauth.service';
import { SecretCipherService } from '../../auth/secret-cipher.service';
import {
  JWT_ISSUER,
  MFA_PENDING_AUDIENCE,
  TokenService,
} from '../../auth/token.service';
import { TwoFactorService } from '../../auth/two-factor.service';
import type { Env } from '../../config/env.schema';
import type { users } from '../../db/schema';
import type { SecurityEventsService } from '../../security-events/security-events.service';
import type { StorageService } from '../../storage/storage.service';

type User = typeof users.$inferSelect;

const CALLBACK = '/auth/oauth/google/callback?code=google-code&state=etat';
const MFA = '/auth/oauth/google/mfa';
const OAUTH_COOKIES = `${OAUTH_STATE_COOKIE}=etat; ${OAUTH_VERIFIER_COOKIE}=verifier`;
const BACKUP_CODE = 'abcde-fghjk';

const twoFactor = new TwoFactorService();
const cipher = new SecretCipherService(TEST_ENV);
const tokens = new TokenService(TEST_ENV);

/** Ligne `users` complète d'un compte Google vérifié, sans 2FA par défaut. */
function aUser(overrides: Partial<User> = {}): User {
  return {
    id: TEST_USER.id,
    email: TEST_USER.email,
    password: null,
    googleId: 'google-1',
    displayName: 'Alice',
    avatarUrl: null,
    emailVerified: new Date('2026-01-01T00:00:00Z'),
    totpSecret: null,
    totpEnabled: null,
    encryptionSalt: null,
    wrappedMasterKey: null,
    recoveryWrappedKey: null,
    encryptionVersion: 0,
    encryptionPassphrase: false,
    authVersion: 1,
    isDemoAccount: false,
    sessionVersion: TEST_USER.sessionVersion,
    totpLastUsedStep: null,
    role: 'user',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

/** Compte protégé par TOTP, et le générateur de codes de son authentificateur. */
function aTotpUser(overrides: Partial<User> = {}) {
  const { secret } = twoFactor.generateSecret(TEST_USER.email);
  const authenticator = new OTPAuth.TOTP({
    issuer: 'DashFlow',
    label: TEST_USER.email,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  const user = aUser({
    totpSecret: cipher.encrypt(secret),
    totpEnabled: new Date('2026-02-01T00:00:00Z'),
    ...overrides,
  });
  return { user, authenticator };
}

/** Cookies posés par une réponse : nom → en-tête `Set-Cookie` complet. */
function cookiesOf(res: Response): Map<string, string> {
  return new Map(
    res.headers.getSetCookie().map((c) => [c.slice(0, c.indexOf('=')), c]),
  );
}
const valueOf = (setCookie: string | undefined): string =>
  setCookie?.slice(setCookie.indexOf('=') + 1).split(';')[0] ?? '';
/** Tout ce que le navigateur renverrait après cette réponse (cookies non vidés). */
const cookieHeader = (res: Response): string =>
  [...cookiesOf(res)]
    .filter(([, c]) => valueOf(c) !== '')
    .map(([name, c]) => `${name}=${valueOf(c)}`)
    .join('; ');

/**
 * App complète (vrais middlewares, vrai AuthService, vrais jetons) ; seuls Google, le dépôt des
 * comptes et le journal de sécurité sont des doublures. `account` est l'unique compte en base.
 */
async function setup(
  account: User | undefined,
  env: Env = TEST_ENV,
  ip = '203.0.113.1',
) {
  let stored = account;
  const unusedBackupCodes = new Set([cipher.hmac(BACKUP_CODE)]);
  const repo = {
    findById: vi.fn((id: string) =>
      Promise.resolve(stored?.id === id ? stored : undefined),
    ),
    updateUser: vi.fn((_id: string, patch: Partial<User>) => {
      if (stored) stored = { ...stored, ...patch };
      return Promise.resolve(stored);
    }),
    consumeBackupCode: vi.fn((_id: string, hash: string) =>
      Promise.resolve(unusedBackupCodes.delete(hash)),
    ),
    countUnusedBackupCodes: vi.fn(() =>
      Promise.resolve(unusedBackupCodes.size),
    ),
  };
  const oauth = {
    createAuthorization: vi.fn(),
    fetchGoogleUser: vi.fn().mockResolvedValue({
      googleId: 'google-1',
      email: TEST_USER.email,
      displayName: 'Alice',
    }),
    findOrCreateGoogleUser: vi.fn(() => Promise.resolve(stored)),
  };
  const securityEvents = { record: vi.fn().mockResolvedValue(undefined) };
  const t = await honoTestApp({
    env,
    oauth: oauth as unknown as OAuthService,
    securityEvents: securityEvents as unknown as SecurityEventsService,
    auth: new AuthService(
      repo as unknown as AuthRepository,
      {} as ConstructorParameters<typeof AuthService>[1],
      twoFactor,
      {} as StorageService,
      cipher,
    ),
  });
  const from = (address: string) => ({ 'X-Forwarded-For': address });
  return {
    securityEvents,
    oauth,
    /** Modifie le compte « en base » après coup (session révoquée, 2FA retirée, suppression). */
    change: (next: User | undefined) => {
      stored = next;
    },
    callback: () =>
      t.anonymous(CALLBACK, {
        headers: { Cookie: OAUTH_COOKIES, ...from(ip) },
      }),
    /** Seconde étape : `cookie` est ce que le navigateur présente, `code` ce que l'utilisateur saisit. */
    mfa: (cookie: string, code: string, address = ip) => {
      const init = jsonInit('POST', { totpCode: code });
      return t.anonymous(MFA, {
        ...init,
        headers: { ...init.headers, Cookie: cookie, ...from(address) },
      });
    },
    me: (cookie: string) =>
      t.anonymous('/auth/me', { headers: { Cookie: cookie, ...from(ip) } }),
    anonymous: t.anonymous,
  };
}

const pendingCookie = (proof: string): string => `${OAUTH_MFA_COOKIE}=${proof}`;
const proofFor = (user: User): Promise<string> =>
  tokens.signMfaPending({ sub: user.id, sv: user.sessionVersion });

afterEach(() => vi.useRealTimers());

describe('Retour Google — un compte protégé par la 2FA n’est pas ouvert par Google seul', () => {
  it('compte 2FA : aucun cookie de session, l’utilisateur reste non authentifié', async () => {
    const { user } = aTotpUser();
    const t = await setup(user);

    const res = await t.callback();

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(
      `${FRONT_ORIGIN}/auth/login?oauth=mfa`,
    );
    expect(cookiesOf(res).has(SESSION_COOKIE)).toBe(false);
    expect((await t.me(cookieHeader(res))).status).toBe(401);
    expect(t.securityEvents.record).not.toHaveBeenCalled();
  });

  it('compte 2FA : pose une preuve en attente dans un cookie HttpOnly de 5 minutes, borné à la route de vérification', async () => {
    const { user } = aTotpUser();
    const t = await setup(user);

    const res = await t.callback();

    const pending = cookiesOf(res).get(OAUTH_MFA_COOKIE) ?? '';
    expect(await tokens.verifyMfaPending(valueOf(pending))).toEqual({
      sub: user.id,
      sv: user.sessionVersion,
    });
    expect(pending).toMatch(/; HttpOnly/i);
    expect(pending).toMatch(/; SameSite=Lax/i);
    expect(pending).toMatch(/; Max-Age=300(;|$)/i);
    expect(pending).toMatch(/; Path=\/auth\/oauth\/google\/mfa(;|$)/i);
    expect(pending).not.toMatch(/; Secure/i);
  });

  it('compte 2FA en HTTPS : le cookie est Secure et son chemin suit le préfixe public de l’API', async () => {
    const { user } = aTotpUser();
    const t = await setup(user, {
      ...TEST_ENV,
      NODE_ENV: 'production',
      APP_URL: 'https://dashflow.example/api',
    });

    const res = await t.callback();

    const pending = cookiesOf(res).get(OAUTH_MFA_COOKIE) ?? '';
    expect(pending).toMatch(/; Secure/i);
    expect(pending).toMatch(/; Path=\/api\/auth\/oauth\/google\/mfa(;|$)/i);
  });

  it('compte 2FA : la preuve ne voyage jamais dans l’URL de redirection', async () => {
    const { user } = aTotpUser();
    const t = await setup(user);

    const res = await t.callback();

    const proof = valueOf(cookiesOf(res).get(OAUTH_MFA_COOKIE));
    expect(proof).not.toBe('');
    expect(res.headers.get('location')).not.toContain(proof);
  });

  it('compte 2FA : la preuve en attente présentée comme cookie de session est refusée', async () => {
    const { user } = aTotpUser();
    const t = await setup(user);

    const res = await t.callback();

    const proof = valueOf(cookiesOf(res).get(OAUTH_MFA_COOKIE));
    expect((await t.me(`${SESSION_COOKIE}=${proof}`)).status).toBe(401);
  });

  it('compte 2FA : les cookies state/verifier sont vidés comme avant', async () => {
    const { user } = aTotpUser();
    const t = await setup(user);

    const res = await t.callback();

    for (const name of [OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE]) {
      expect(cookiesOf(res).get(name)).toMatch(
        new RegExp(`^${name}=;.*Max-Age=0`, 'i'),
      );
    }
  });

  it('compte sans 2FA : la session s’ouvre comme avant (cookie, login_oauth, ?oauth=success)', async () => {
    const user = aUser();
    const t = await setup(user);

    const res = await t.callback();

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(
      `${FRONT_ORIGIN}/auth/login?oauth=success`,
    );
    expect(cookiesOf(res).has(OAUTH_MFA_COOKIE)).toBe(false);
    const me = await t.me(cookieHeader(res));
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ id: user.id, totpEnabled: false });
    expect(t.securityEvents.record).toHaveBeenCalledTimes(1);
    expect(t.securityEvents.record).toHaveBeenCalledWith(
      'login_oauth',
      user.id,
      expect.objectContaining({ ip: '203.0.113.1' }),
    );
  });

  it('state différent du cookie : ?error=oauth_expired, Google jamais interrogé', async () => {
    const t = await setup(aUser());

    const res = await t.anonymous(CALLBACK, {
      headers: {
        Cookie: `${OAUTH_STATE_COOKIE}=autre; ${OAUTH_VERIFIER_COOKIE}=v`,
      },
    });

    expect(res.headers.get('location')).toBe(
      `${FRONT_ORIGIN}/auth/login?error=oauth_expired`,
    );
    expect(t.oauth.fetchGoogleUser).not.toHaveBeenCalled();
  });
});

describe('POST /auth/oauth/google/mfa — second facteur après Google', () => {
  it('preuve + code TOTP valide : ouvre la session, vide la preuve, journalise login_oauth', async () => {
    const { user, authenticator } = aTotpUser();
    const t = await setup(user);
    const pending = cookieHeader(await t.callback());

    const res = await t.mfa(pending, authenticator.generate());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: 'Connecté' });
    expect(cookiesOf(res).get(OAUTH_MFA_COOKIE)).toMatch(
      new RegExp(`^${OAUTH_MFA_COOKIE}=;.*Max-Age=0`, 'i'),
    );
    const me = await t.me(cookieHeader(res));
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ id: user.id, totpEnabled: true });
    expect(
      t.securityEvents.record.mock.calls.map((c) => c.slice(0, 2)),
    ).toEqual([['login_oauth', user.id]]);
  });

  it('code TOTP faux : 401, aucune session, la preuve reste utilisable, login_failed journalisé', async () => {
    const { user, authenticator } = aTotpUser();
    const t = await setup(user);
    const pending = cookieHeader(await t.callback());
    const wrong = authenticator.generate() === '000000' ? '111111' : '000000';

    const res = await t.mfa(pending, wrong);

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ message: 'Code 2FA invalide' });
    expect(cookiesOf(res).size).toBe(0);
    expect((await t.me(cookieHeader(res))).status).toBe(401);
    expect(
      t.securityEvents.record.mock.calls.map((c) => c.slice(0, 2)),
    ).toEqual([['login_failed', user.id]]);
    expect((await t.mfa(pending, authenticator.generate())).status).toBe(200);
  });

  it('un code TOTP déjà accepté ne rouvre pas de session avec la même preuve (rejeu)', async () => {
    const { user, authenticator } = aTotpUser();
    const t = await setup(user);
    const pending = cookieHeader(await t.callback());
    const code = authenticator.generate();

    const first = await t.mfa(pending, code);
    const replay = await t.mfa(pending, code);

    expect(first.status).toBe(200);
    expect(replay.status).toBe(401);
    expect(cookiesOf(replay).has(SESSION_COOKIE)).toBe(false);
  });

  it('code de secours : ouvre la session une fois, annonce le restant, journalise backup_code_used', async () => {
    const { user } = aTotpUser();
    const t = await setup(user);
    const pending = cookieHeader(await t.callback());

    const res = await t.mfa(pending, 'ABCDE FGHJK');
    const reused = await t.mfa(pending, BACKUP_CODE);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      message: 'Connecté',
      backupCodesRemaining: 0,
    });
    expect(cookiesOf(res).has(SESSION_COOKIE)).toBe(true);
    expect(reused.status).toBe(401);
    expect(t.securityEvents.record.mock.calls.map((c) => c[0])).toEqual([
      'login_oauth',
      'backup_code_used',
      'login_failed',
    ]);
  });

  it('sans preuve : 401 MFA_PROOF_REJECTED, même avec un code valide', async () => {
    const { user, authenticator } = aTotpUser();
    const t = await setup(user);

    const res = await t.mfa('', authenticator.generate());

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: 'MFA_PROOF_REJECTED' });
    expect(cookiesOf(res).has(SESSION_COOKIE)).toBe(false);
    expect(t.securityEvents.record).not.toHaveBeenCalled();
  });

  it('preuve expirée (plus de 5 minutes) : 401, cookie vidé, aucune session', async () => {
    const { user, authenticator } = aTotpUser();
    const t = await setup(user);
    const expired = jwt.sign(
      { sub: user.id, sv: user.sessionVersion },
      TEST_ENV.JWT_SECRET,
      {
        algorithm: 'HS256',
        issuer: JWT_ISSUER,
        audience: MFA_PENDING_AUDIENCE,
        expiresIn: -1,
      },
    );

    const res = await t.mfa(pendingCookie(expired), authenticator.generate());

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: 'MFA_PROOF_REJECTED' });
    expect(cookiesOf(res).get(OAUTH_MFA_COOKIE)).toMatch(/Max-Age=0/i);
    expect(cookiesOf(res).has(SESSION_COOKIE)).toBe(false);
  });

  it('un jeton de session présenté comme preuve est refusé', async () => {
    const { user, authenticator } = aTotpUser();
    const t = await setup(user);
    const session = await tokens.sign({
      sub: user.id,
      email: user.email,
      sv: user.sessionVersion,
    });

    const res = await t.mfa(pendingCookie(session), authenticator.generate());

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: 'MFA_PROOF_REJECTED' });
    expect(cookiesOf(res).has(SESSION_COOKIE)).toBe(false);
  });

  it.each([
    [
      'la session a été révoquée depuis l’émission',
      (u: User): User | undefined => ({
        ...u,
        sessionVersion: u.sessionVersion + 1,
      }),
    ],
    [
      'la 2FA a été désactivée depuis l’émission',
      (u: User): User | undefined => ({
        ...u,
        totpEnabled: null,
        totpSecret: null,
      }),
    ],
    ['le compte a été supprimé depuis', (): User | undefined => undefined],
  ])(
    'preuve périmée quand %s : 401, cookie vidé, aucune session',
    async (_cas, after) => {
      const { user, authenticator } = aTotpUser();
      const t = await setup(user);
      const pending = pendingCookie(await proofFor(user));
      t.change(after(user));

      const res = await t.mfa(pending, authenticator.generate());

      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ code: 'MFA_PROOF_REJECTED' });
      expect(cookiesOf(res).get(OAUTH_MFA_COOKIE)).toMatch(/Max-Age=0/i);
      expect(cookiesOf(res).has(SESSION_COOKIE)).toBe(false);
      expect(t.securityEvents.record).not.toHaveBeenCalled();
    },
  );

  it('corps sans code, ou non déclaré JSON : 400, aucune session', async () => {
    const { user, authenticator } = aTotpUser();
    const t = await setup(user);
    const pending = pendingCookie(await proofFor(user));

    const empty = await t.anonymous(MFA, {
      ...jsonInit('POST', {}),
      headers: { 'Content-Type': 'application/json', Cookie: pending },
    });
    const notJson = await t.anonymous(MFA, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', Cookie: pending },
      body: JSON.stringify({ totpCode: authenticator.generate() }),
    });

    expect(empty.status).toBe(400);
    expect(notJson.status).toBe(400);
    expect(cookiesOf(notJson).has(SESSION_COOKIE)).toBe(false);
  });

  it('throttling par IP : 10 essais puis 429, comme /auth/login', async () => {
    const { user } = aTotpUser();
    const t = await setup(user);

    const statuses: number[] = [];
    for (let i = 0; i < 11; i++)
      statuses.push((await t.mfa('', '000000')).status);

    expect(statuses).toEqual([...Array<number>(10).fill(401), 429]);
  });

  it('throttling par compte : 10 essais répartis sur 10 adresses, la 11e adresse est bloquée', async () => {
    const { user, authenticator } = aTotpUser();
    const t = await setup(user);
    const pending = pendingCookie(await proofFor(user));
    const wrong = authenticator.generate() === '000000' ? '111111' : '000000';

    const statuses: number[] = [];
    for (let i = 0; i < 10; i++)
      statuses.push((await t.mfa(pending, wrong, `198.51.100.${i}`)).status);
    const blocked = await t.mfa(
      pending,
      authenticator.generate(),
      '198.51.100.200',
    );

    expect(statuses).toEqual(Array<number>(10).fill(401));
    expect(blocked.status).toBe(429);
    expect(cookiesOf(blocked).has(SESSION_COOKIE)).toBe(false);
  });
});
