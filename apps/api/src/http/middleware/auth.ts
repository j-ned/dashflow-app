import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { CSRF_HEADER } from '../../auth/cookie';
import type { CsrfPolicy } from '../../auth/csrf-policy';
import { assertNotDemo } from '../../auth/demo-restriction';
import type { RoleChecker, UserRole } from '../../auth/role-checker';
import type { SessionAuthenticator } from '../../auth/session-authenticator';
import type { AppEnv } from '../types';

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Cookie de session → `c.get('user')`, ou 401 (mêmes messages que JwtAuthGuard). */
export const requireAuth = (sessions: SessionAuthenticator) =>
  createMiddleware<AppEnv>(async (c, next) => {
    c.set('user', await sessions.authenticate(getCookie(c)));
    await next();
  });

/**
 * Origine + jeton CSRF sur toute MUTATION (méthode non sûre). Sûr par défaut : monté avec
 * `requireAuth` sur un groupe de routes, aucune mutation authentifiée ne peut l'oublier.
 */
export const csrfOnMutations = (policy: CsrfPolicy) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (!SAFE_METHODS.has(c.req.method)) {
      policy.assert(
        {
          origin: c.req.header('origin'),
          referer: c.req.header('referer'),
          token: c.req.header(CSRF_HEADER),
        },
        c.get('user'),
      );
    }
    await next();
  });

/** Actions interdites à la session démo partagée (cf. assertNotDemo). */
export const rejectDemo = () =>
  createMiddleware<AppEnv>(async (c, next) => {
    assertNotDemo(c.get('user'));
    await next();
  });

/** Rôle relu en base (cf. RoleChecker), après `requireAuth`. */
export const requireRole = (roles: RoleChecker, ...required: UserRole[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    await roles.assert(c.get('user')?.id, required);
    await next();
  });
