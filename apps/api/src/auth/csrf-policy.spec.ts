import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '../common/errors';
import { CsrfPolicy, type CsrfRequest } from './csrf-policy';
import { CsrfService } from './csrf.service';
import type { AuthUser } from './auth-user';

const csrf = new CsrfService({ JWT_SECRET: 's'.repeat(40) });
const user: AuthUser = { id: 'u1', email: 'a@b.c', sessionVersion: 2 };

const policy = (nodeEnv: 'test' | 'production' = 'test') =>
  new CsrfPolicy(csrf, {
    CORS_ORIGIN: 'https://dashflow.example, http://localhost:4200/',
    NODE_ENV: nodeEnv,
  });

/** `user: null` = pas d'utilisateur (un paramètre par défaut avalerait `undefined`). */
const check =
  (
    req: CsrfRequest,
    u: AuthUser | null = user,
    nodeEnv: 'test' | 'production' = 'test',
  ) =>
  () =>
    policy(nodeEnv).assert(req, u ?? undefined);

describe('CsrfPolicy', () => {
  const good = csrf.tokenFor('u1', 2);

  it('passe : jeton de la session + Origin autorisée', () => {
    expect(
      check({ token: good, origin: 'https://dashflow.example' }),
    ).not.toThrow();
  });

  it("Referer accepté à défaut d'Origin ; slash final de CORS_ORIGIN toléré", () => {
    expect(
      check({ token: good, referer: 'http://localhost:4200/budget/x' }),
    ).not.toThrow();
  });

  it('403 : jeton d’une autre session (sv), jeton absent, pas d’utilisateur', () => {
    const stale = csrf.tokenFor('u1', 1);
    expect(check({ token: stale, origin: 'https://dashflow.example' })).toThrow(
      ForbiddenError,
    );
    expect(check({ origin: 'https://dashflow.example' })).toThrow(
      ForbiddenError,
    );
    expect(
      check({ token: good, origin: 'https://dashflow.example' }, null),
    ).toThrow(ForbiddenError);
  });

  it('403 : Origin étrangère, même avec un bon jeton (cookie tossing / site piégé)', () => {
    expect(check({ token: good, origin: 'https://evil.example' })).toThrow(
      /Origine non autorisée/,
    );
    // `Origin: null` (page sandboxée, redirection cross-origin) vaut « pas d'origine » : refusée en prod.
    expect(check({ token: good, origin: 'null' }, user, 'production')).toThrow(
      /Origine manquante/,
    );
  });

  it('Origin absente : tolérée hors production (tests), refusée en production', () => {
    expect(check({ token: good }, user, 'test')).not.toThrow();
    expect(check({ token: good }, user, 'production')).toThrow(
      /Origine manquante/,
    );
  });
});
