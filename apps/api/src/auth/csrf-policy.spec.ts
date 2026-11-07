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

describe('CsrfPolicy — preview Vercel', () => {
  const good = csrf.tokenFor('u1', 2);
  const deploymentHost = 'dashflow-app-abc123-team.vercel.app';
  const branchHost = 'dashflow-app-git-feat-x-team.vercel.app';
  const previewPolicy = (vercelEnv: 'preview' | 'production') =>
    new CsrfPolicy(csrf, {
      CORS_ORIGIN: 'http://localhost:4200',
      NODE_ENV: 'production',
      VERCEL_ENV: vercelEnv,
      VERCEL_URL: deploymentHost,
      VERCEL_BRANCH_URL: branchHost,
    });

  it('accepte l’origine de la preview elle-même (URL de déploiement et de branche)', () => {
    for (const host of [deploymentHost, branchHost])
      expect(() =>
        previewPolicy('preview').assert(
          { token: good, origin: `https://${host}` },
          user,
        ),
      ).not.toThrow();
  });

  it('refuse toujours une origine étrangère et une origine absente en preview', () => {
    expect(() =>
      previewPolicy('preview').assert(
        { token: good, origin: 'https://evil.vercel.app' },
        user,
      ),
    ).toThrow(/Origine non autorisée/);
    expect(() =>
      new CsrfPolicy(csrf, {
        CORS_ORIGIN: 'http://localhost:4200',
        NODE_ENV: 'test',
        VERCEL_ENV: 'preview',
      }).assert({ token: good }, user),
    ).toThrow(/Origine manquante/);
  });

  it('en production, seule CORS_ORIGIN fait foi (VERCEL_URL ignorée)', () => {
    expect(() =>
      previewPolicy('production').assert(
        { token: good, origin: `https://${deploymentHost}` },
        user,
      ),
    ).toThrow(/Origine non autorisée/);
  });
});
