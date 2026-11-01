import { describe, it, expect, vi } from 'vitest';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SESSION_COOKIE, SESSION_COOKIE_HOST } from '../../auth/cookie';
import type { TokenService } from '../../auth/token.service';
import type { DrizzleDB } from '../../db/drizzle.constants';

function ctx(cookies: Record<string, string>) {
  const req: { cookies: Record<string, string>; user?: unknown } = { cookies };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

/** Mock Drizzle : `select().from().where().limit()` → lignes fournies. */
function dbWith(rows: { sessionVersion: number }[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  return { select: vi.fn().mockReturnValue({ from }) } as unknown as DrizzleDB;
}

const tokenWith = (payload: unknown) =>
  ({ verify: vi.fn().mockResolvedValue(payload) }) as unknown as TokenService;

describe('JwtAuthGuard', () => {
  it('passe et attache request.user quand le cookie est valide et la version de session courante', async () => {
    const guard = new JwtAuthGuard(
      tokenWith({ sub: 'u1', email: 'a@b.com', sv: 3 }),
      dbWith([{ sessionVersion: 3 }]),
    );
    const c = ctx({ [SESSION_COOKIE]: 'tok' });
    expect(await guard.canActivate(c)).toBe(true);
    expect(c.switchToHttp().getRequest().user).toEqual({
      id: 'u1',
      email: 'a@b.com',
      sessionVersion: 3,
      isDemo: false,
    });
  });

  it('attache isDemo: true quand le JWT porte le claim demo (session /auth/demo-login)', async () => {
    const guard = new JwtAuthGuard(
      tokenWith({ sub: 'demo', email: 'demo@x.io', sv: 0, demo: true }),
      dbWith([{ sessionVersion: 0 }]),
    );
    const c = ctx({ [SESSION_COOKIE]: 'tok' });
    expect(await guard.canActivate(c)).toBe(true);
    expect(c.switchToHttp().getRequest().user).toEqual({
      id: 'demo',
      email: 'demo@x.io',
      sessionVersion: 0,
      isDemo: true,
    });
  });

  it('401 sans cookie', async () => {
    const guard = new JwtAuthGuard(tokenWith({}), dbWith([]));
    await expect(guard.canActivate(ctx({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('401 si la signature est invalide (verify rejette)', async () => {
    const guard = new JwtAuthGuard(
      {
        verify: vi.fn().mockRejectedValue(new Error('bad')),
      } as unknown as TokenService,
      dbWith([{ sessionVersion: 0 }]),
    );
    await expect(
      guard.canActivate(ctx({ [SESSION_COOKIE]: 'tok' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('401 « Session révoquée » quand session_version en base a avancé (logout, reset, changement de mot de passe)', async () => {
    const guard = new JwtAuthGuard(
      tokenWith({ sub: 'u1', email: 'a@b.com', sv: 2 }),
      dbWith([{ sessionVersion: 3 }]),
    );
    await expect(
      guard.canActivate(ctx({ [SESSION_COOKIE]: 'tok' })),
    ).rejects.toThrow('Session révoquée');
  });

  it('401 quand l’utilisateur n’existe plus (compte supprimé, token encore valide)', async () => {
    const guard = new JwtAuthGuard(
      tokenWith({ sub: 'ghost', email: 'g@b.com', sv: 0 }),
      dbWith([]),
    );
    await expect(
      guard.canActivate(ctx({ [SESSION_COOKIE]: 'tok' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('lit aussi le cookie préfixé __Host- (nom de production)', async () => {
    const guard = new JwtAuthGuard(
      tokenWith({ sub: 'u1', email: 'a@b.com', sv: 3 }),
      dbWith([{ sessionVersion: 3 }]),
    );
    const c = ctx({ [SESSION_COOKIE_HOST]: 'tok' });
    expect(await guard.canActivate(c)).toBe(true);
  });
});
