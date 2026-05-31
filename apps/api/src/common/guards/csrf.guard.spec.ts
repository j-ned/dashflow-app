import { describe, it, expect } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';
import { CSRF_COOKIE } from '../../auth/cookie';

function ctx(cookie?: string, header?: string) {
  const req: any = { cookies: cookie ? { [CSRF_COOKIE]: cookie } : {}, headers: header ? { 'x-csrf-token': header } : {} };
  return { switchToHttp: () => ({ getRequest: () => req }) } as any;
}

describe('CsrfGuard', () => {
  const g = new CsrfGuard();
  it('passe quand header == cookie', () => { expect(g.canActivate(ctx('t', 't'))).toBe(true); });
  it('403 si mismatch', () => { expect(() => g.canActivate(ctx('t', 'x'))).toThrow(ForbiddenException); });
  it('403 si manquant', () => { expect(() => g.canActivate(ctx())).toThrow(ForbiddenException); });
});
