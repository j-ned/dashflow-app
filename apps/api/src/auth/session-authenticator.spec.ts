import { describe, it, expect, vi } from 'vitest';
import { UnauthorizedError } from '../common/errors';
import type { DrizzleDB } from '../db/drizzle.constants';
import { SESSION_COOKIE, SESSION_COOKIE_HOST } from './cookie';
import { SessionAuthenticator } from './session-authenticator';
import type { TokenService } from './token.service';

/** Mock Drizzle : `select().from().where().limit()` → lignes fournies. */
function dbWith(rows: { sessionVersion: number }[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  return { select: vi.fn().mockReturnValue({ from }) } as unknown as DrizzleDB;
}

const tokenWith = (payload: unknown) =>
  ({ verify: vi.fn().mockResolvedValue(payload) }) as unknown as TokenService;

describe('SessionAuthenticator', () => {
  it("rend l'utilisateur quand le cookie est valide et la version de session courante", async () => {
    const auth = new SessionAuthenticator(
      tokenWith({ sub: 'u1', email: 'a@b.com', sv: 3 }),
      dbWith([{ sessionVersion: 3 }]),
    );
    await expect(
      auth.authenticate({ [SESSION_COOKIE]: 'tok' }),
    ).resolves.toEqual({
      id: 'u1',
      email: 'a@b.com',
      sessionVersion: 3,
      isDemo: false,
    });
  });

  it('rend isDemo: true quand le JWT porte le claim demo (session /auth/demo-login)', async () => {
    const auth = new SessionAuthenticator(
      tokenWith({ sub: 'demo', email: 'demo@x.io', sv: 0, demo: true }),
      dbWith([{ sessionVersion: 0 }]),
    );
    await expect(
      auth.authenticate({ [SESSION_COOKIE]: 'tok' }),
    ).resolves.toEqual({
      id: 'demo',
      email: 'demo@x.io',
      sessionVersion: 0,
      isDemo: true,
    });
  });

  it('401 « Non authentifié » sans cookie', async () => {
    const auth = new SessionAuthenticator(tokenWith({}), dbWith([]));
    const attempt = auth.authenticate({});
    await expect(attempt).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(attempt).rejects.toThrow('Non authentifié');
    await expect(auth.authenticate(undefined)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('401 « Session invalide » si la signature est invalide (verify rejette)', async () => {
    const auth = new SessionAuthenticator(
      {
        verify: vi.fn().mockRejectedValue(new Error('bad')),
      } as unknown as TokenService,
      dbWith([{ sessionVersion: 0 }]),
    );
    const attempt = auth.authenticate({ [SESSION_COOKIE]: 'tok' });
    await expect(attempt).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(attempt).rejects.toThrow('Session invalide');
  });

  it('401 « Session révoquée » quand session_version en base a avancé (logout, reset, changement de mot de passe)', async () => {
    const auth = new SessionAuthenticator(
      tokenWith({ sub: 'u1', email: 'a@b.com', sv: 2 }),
      dbWith([{ sessionVersion: 3 }]),
    );
    const attempt = auth.authenticate({ [SESSION_COOKIE]: 'tok' });
    await expect(attempt).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(attempt).rejects.toThrow('Session révoquée');
  });

  it('401 quand l’utilisateur n’existe plus (compte supprimé, token encore valide)', async () => {
    const auth = new SessionAuthenticator(
      tokenWith({ sub: 'ghost', email: 'g@b.com', sv: 0 }),
      dbWith([]),
    );
    const attempt = auth.authenticate({ [SESSION_COOKIE]: 'tok' });
    await expect(attempt).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(attempt).rejects.toThrow('Session révoquée');
  });

  it('lit aussi le cookie préfixé __Host- (nom de production)', async () => {
    const auth = new SessionAuthenticator(
      tokenWith({ sub: 'u1', email: 'a@b.com', sv: 3 }),
      dbWith([{ sessionVersion: 3 }]),
    );
    await expect(
      auth.authenticate({ [SESSION_COOKIE_HOST]: 'tok' }),
    ).resolves.toMatchObject({ id: 'u1' });
  });
});
