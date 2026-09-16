import { describe, it, expect } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { CsrfGuard } from './csrf.guard';
import { CsrfService } from '../../auth/csrf.service';

const config = (env: Record<string, string>) =>
  ({ get: (k: string) => env[k] }) as unknown as ConfigService;
const csrf = new CsrfService(config({ JWT_SECRET: 's'.repeat(40) }));
const user = { id: 'u1', email: 'a@b.c', sessionVersion: 2 };

function ctx(headers: Record<string, string>, withUser = true) {
  const req = { headers, user: withUser ? user : undefined };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}
const guard = (nodeEnv = 'test') =>
  new CsrfGuard(
    csrf,
    config({
      CORS_ORIGIN: 'https://dashflow.example, http://localhost:4200/',
      NODE_ENV: nodeEnv,
    }),
  );

describe('CsrfGuard', () => {
  const good = csrf.tokenFor('u1', 2);

  it('passe : jeton de la session + Origin autorisée', () => {
    expect(
      guard().canActivate(
        ctx({ 'x-csrf-token': good, origin: 'https://dashflow.example' }),
      ),
    ).toBe(true);
  });

  it("Referer accepté à défaut d'Origin ; slash final de CORS_ORIGIN toléré", () => {
    expect(
      guard().canActivate(
        ctx({
          'x-csrf-token': good,
          referer: 'http://localhost:4200/budget/x',
        }),
      ),
    ).toBe(true);
  });

  it('403 : jeton d’une autre session (sv), jeton absent, pas d’utilisateur', () => {
    const stale = csrf.tokenFor('u1', 1);
    expect(() =>
      guard().canActivate(
        ctx({ 'x-csrf-token': stale, origin: 'https://dashflow.example' }),
      ),
    ).toThrow(ForbiddenException);
    expect(() =>
      guard().canActivate(ctx({ origin: 'https://dashflow.example' })),
    ).toThrow(ForbiddenException);
    expect(() =>
      guard().canActivate(
        ctx(
          { 'x-csrf-token': good, origin: 'https://dashflow.example' },
          false,
        ),
      ),
    ).toThrow(ForbiddenException);
  });

  it('403 : Origin étrangère, même avec un bon jeton (cookie tossing / site piégé)', () => {
    expect(() =>
      guard().canActivate(
        ctx({ 'x-csrf-token': good, origin: 'https://evil.example' }),
      ),
    ).toThrow(/Origine non autorisée/);
    // `Origin: null` (page sandboxée, redirection cross-origin) vaut « pas d'origine » : refusée en prod.
    expect(() =>
      guard('production').canActivate(
        ctx({ 'x-csrf-token': good, origin: 'null' }),
      ),
    ).toThrow(/Origine manquante/);
  });

  it('Origin absente : tolérée hors production (tests), refusée en production', () => {
    expect(guard('test').canActivate(ctx({ 'x-csrf-token': good }))).toBe(true);
    expect(() =>
      guard('production').canActivate(ctx({ 'x-csrf-token': good })),
    ).toThrow(/Origine manquante/);
  });
});
