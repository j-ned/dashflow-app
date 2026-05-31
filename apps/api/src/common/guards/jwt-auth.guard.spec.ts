import { describe, it, expect, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SESSION_COOKIE } from '../../auth/cookie';

function ctx(cookies: Record<string, string>) {
  const req: any = { cookies };
  return { switchToHttp: () => ({ getRequest: () => req }) } as any;
}

describe('JwtAuthGuard', () => {
  it('passe et attache request.user quand le cookie est valide', async () => {
    const token = { verify: vi.fn().mockResolvedValue({ sub: 'u1', email: 'a@b.com' }) };
    const guard = new JwtAuthGuard(token as any);
    const c = ctx({ [SESSION_COOKIE]: 'tok' });
    expect(await guard.canActivate(c)).toBe(true);
    expect(c.switchToHttp().getRequest().user).toEqual({ id: 'u1', email: 'a@b.com' });
  });
  it('401 sans cookie', async () => {
    const guard = new JwtAuthGuard({ verify: vi.fn() } as any);
    await expect(guard.canActivate(ctx({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
