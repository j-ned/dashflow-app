import { describe, it, expect } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { CsrfService } from './csrf.service';

const config = (secret: string) =>
  ({ get: () => secret }) as unknown as ConfigService;

describe('CsrfService', () => {
  const svc = new CsrfService(config('s'.repeat(40)));

  it('déterministe pour (user, sv), différent dès que la session change', () => {
    const t = svc.tokenFor('u1', 3);
    expect(svc.tokenFor('u1', 3)).toBe(t);
    expect(svc.tokenFor('u1', 4)).not.toBe(t); // logout / reset → jeton invalidé
    expect(svc.tokenFor('u2', 3)).not.toBe(t);
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('verify : temps constant, refuse vide, autre type, mauvais jeton, autre secret', () => {
    const t = svc.tokenFor('u1', 3);
    expect(svc.verify(t, 'u1', 3)).toBe(true);
    expect(svc.verify(t, 'u1', 4)).toBe(false);
    expect(svc.verify('', 'u1', 3)).toBe(false);
    expect(svc.verify(undefined, 'u1', 3)).toBe(false);
    expect(svc.verify(['x'], 'u1', 3)).toBe(false);
    const other = new CsrfService(config('o'.repeat(40)));
    expect(other.verify(t, 'u1', 3)).toBe(false);
  });
});
