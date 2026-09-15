import { describe, it, expect } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { DemoAccountGuard } from './demo-account.guard';

function ctx(user: unknown) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('DemoAccountGuard', () => {
  const guard = new DemoAccountGuard();

  it('given session démo (isDemo: true), then 403', () => {
    expect(() =>
      guard.canActivate(ctx({ id: 'demo', email: 'd@x.io', isDemo: true })),
    ).toThrow(ForbiddenException);
  });

  it('given session normale (isDemo: false), then passe', () => {
    expect(
      guard.canActivate(ctx({ id: 'u1', email: 'a@b.com', isDemo: false })),
    ).toBe(true);
  });

  it('given user sans isDemo (ancien JWT sans claim), then passe', () => {
    expect(guard.canActivate(ctx({ id: 'u1', email: 'a@b.com' }))).toBe(true);
  });

  it('given aucun user (garde mal ordonné), then passe : JwtAuthGuard reste responsable du 401', () => {
    expect(guard.canActivate(ctx(undefined))).toBe(true);
  });
});
