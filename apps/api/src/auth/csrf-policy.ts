import type { Env } from '../config/env.schema';
import { ForbiddenError } from '../common/errors';
import type { AuthUser } from './auth-user';
import type { CsrfService } from './csrf.service';

export type CsrfRequest = {
  readonly origin?: string;
  readonly referer?: string;
  /** Valeur de l'en-tête `X-CSRF-Token`. */
  readonly token?: string;
};

/**
 * Deux barrières indépendantes sur les mutations authentifiées (APRÈS l'authentification) :
 *  1. `Origin` (ou l'origine du `Referer`) doit être une origine front autorisée (CORS_ORIGIN) ;
 *     un navigateur l'envoie toujours sur une requête cross-site, un formulaire piégé aussi.
 *     Absente : refus en production (client non-navigateur ou proxy qui la retire), tolérée
 *     ailleurs pour les tests.
 *  2. `X-CSRF-Token` doit être le HMAC de la session courante (cf. CsrfService).
 */
export class CsrfPolicy {
  private readonly allowedOrigins: ReadonlySet<string>;
  private readonly isProd: boolean;

  constructor(
    private readonly csrf: CsrfService,
    config: Pick<Env, 'CORS_ORIGIN' | 'NODE_ENV'>,
  ) {
    this.allowedOrigins = new Set(
      config.CORS_ORIGIN.split(',')
        .map((o) => o.trim().replace(/\/$/, ''))
        .filter(Boolean),
    );
    this.isProd = config.NODE_ENV === 'production';
  }

  assert(req: CsrfRequest, user: AuthUser | undefined): void {
    this.assertOrigin(req);
    if (!user || !this.csrf.verify(req.token, user.id, user.sessionVersion)) {
      throw new ForbiddenError('Jeton CSRF invalide');
    }
  }

  private assertOrigin(req: CsrfRequest): void {
    const origin = CsrfPolicy.originOf(req);
    if (origin === null) {
      if (this.isProd) throw new ForbiddenError('Origine manquante');
      return;
    }
    if (!this.allowedOrigins.has(origin)) {
      throw new ForbiddenError('Origine non autorisée');
    }
  }

  /** `Origin`, sinon l'origine du `Referer` ; `null` si aucun des deux n'est exploitable. */
  static originOf(req: Pick<CsrfRequest, 'origin' | 'referer'>): string | null {
    const raw = req.origin ?? req.referer;
    if (typeof raw !== 'string' || raw === '' || raw === 'null') return null;
    try {
      return new URL(raw).origin;
    } catch {
      return null;
    }
  }
}
