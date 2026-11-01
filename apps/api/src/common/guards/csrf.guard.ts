import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { CSRF_HEADER } from '../../auth/cookie';
import { CsrfService } from '../../auth/csrf.service';
import type { AuthUser } from '../decorators/current-user.decorator';
import type { Env } from '../../config/env.schema';

/**
 * Deux barrières indépendantes sur les mutations authentifiées (à placer APRÈS JwtAuthGuard) :
 *  1. `Origin` (ou l'origine du `Referer`) doit être une origine front autorisée (CORS_ORIGIN) ;
 *     un navigateur l'envoie toujours sur une requête cross-site, un formulaire piégé aussi.
 *     Absente : refus en production (client non-navigateur ou proxy qui la retire), tolérée
 *     ailleurs pour les tests.
 *  2. `X-CSRF-Token` doit être le HMAC de la session courante (cf. CsrfService).
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigins: ReadonlySet<string>;
  private readonly isProd: boolean;

  constructor(
    private readonly csrf: CsrfService,
    config: ConfigService<Env, true>,
  ) {
    this.allowedOrigins = new Set(
      config
        .get('CORS_ORIGIN', { infer: true })
        .split(',')
        .map((o) => o.trim().replace(/\/$/, ''))
        .filter(Boolean),
    );
    this.isProd = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    this.assertOrigin(req);
    const user = req.user;
    if (
      !user ||
      !this.csrf.verify(req.headers[CSRF_HEADER], user.id, user.sessionVersion)
    ) {
      throw new ForbiddenException('Jeton CSRF invalide');
    }
    return true;
  }

  private assertOrigin(req: Request): void {
    const origin = CsrfGuard.originOf(req);
    if (origin === null) {
      if (this.isProd) throw new ForbiddenException('Origine manquante');
      return;
    }
    if (!this.allowedOrigins.has(origin)) {
      throw new ForbiddenException('Origine non autorisée');
    }
  }

  /** `Origin`, sinon l'origine du `Referer` ; `null` si aucun des deux n'est exploitable. */
  static originOf(req: Request): string | null {
    const raw = req.headers.origin ?? req.headers.referer;
    if (typeof raw !== 'string' || raw === '' || raw === 'null') return null;
    try {
      return new URL(raw).origin;
    } catch {
      return null;
    }
  }
}
