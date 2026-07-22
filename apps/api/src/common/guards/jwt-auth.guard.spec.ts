import { describe, it, expect, vi } from 'vitest';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SESSION_COOKIE } from '../../auth/cookie';
import type { TokenService } from '../../auth/token.service';

function ctx(cookies: Record<string, string>) {
  const req: { cookies: Record<string, string>; user?: unknown } = { cookies };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  it('passe et attache request.user quand le cookie est valide', async () => {
    const token = {
      verify: vi.fn().mockResolvedValue({ sub: 'u1', email: 'a@b.com' }),
    };
    const guard = new JwtAuthGuard(token as unknown as TokenService);
    const c = ctx({ [SESSION_COOKIE]: 'tok' });
    expect(await guard.canActivate(c)).toBe(true);
    expect(c.switchToHttp().getRequest().user).toEqual({
      id: 'u1',
      email: 'a@b.com',
    });
  });
  it('401 sans cookie', async () => {
    const guard = new JwtAuthGuard({
      verify: vi.fn(),
    } as unknown as TokenService);
    await expect(guard.canActivate(ctx({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
