import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { CSRF_HEADER } from '../../auth/cookie';
import { CsrfService } from '../../auth/csrf.service';
import { CsrfPolicy } from '../../auth/csrf-policy';
import type { AuthUser } from '../../auth/auth-user';
import type { Env } from '../../config/env.schema';

const header = (value: string | string[] | undefined): string | undefined =>
  typeof value === 'string' ? value : undefined;

/** Adaptateur Nest de CsrfPolicy (à placer APRÈS JwtAuthGuard). */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly policy: CsrfPolicy;

  constructor(csrf: CsrfService, config: ConfigService<Env, true>) {
    this.policy = new CsrfPolicy(csrf, {
      CORS_ORIGIN: config.get('CORS_ORIGIN', { infer: true }),
      NODE_ENV: config.get('NODE_ENV', { infer: true }),
    });
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    this.policy.assert(
      {
        origin: header(req.headers.origin),
        referer: header(req.headers.referer),
        token: header(req.headers[CSRF_HEADER]),
      },
      req.user,
    );
    return true;
  }
}
