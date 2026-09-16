import {
  type CallHandler,
  type ExecutionContext,
  HttpException,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { type Observable, tap } from 'rxjs';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  SECURITY_EVENT_KEY,
  type SecurityEventOptions,
} from './security-event.decorator';
import { SecurityEventsService } from './security-events.service';

type Req = Request & { user?: AuthUser };

/**
 * Journalise les routes décorées `@SecurityEvent`. L'utilisateur est pris dans l'ordre : la
 * session (`req.user`), la réponse (`{ user: { id } }` d'un login), enfin `req.body.email`.
 * Les sessions démo ne sont pas journalisées (bruit, compte partagé).
 */
@Injectable()
export class SecurityEventsInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly events: SecurityEventsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const opts = this.reflector.get<SecurityEventOptions | undefined>(
      SECURITY_EVENT_KEY,
      context.getHandler(),
    );
    if (!opts) return next.handle();
    const req = context.switchToHttp().getRequest<Req>();
    if (req.user?.isDemo) return next.handle();

    return next.handle().pipe(
      tap({
        next: (body: unknown) => void this.onSuccess(opts, req, body),
        error: (err: unknown) => void this.onError(opts, req, err),
      }),
    );
  }

  private async onSuccess(
    opts: SecurityEventOptions,
    req: Req,
    body: unknown,
  ): Promise<void> {
    const fromBody = (body as { user?: { id?: unknown } } | null)?.user?.id;
    const userId =
      req.user?.id ?? (typeof fromBody === 'string' ? fromBody : undefined);
    if (userId) {
      await this.events.record(opts.success, userId, req);
      // Connexion par code de secours : événement à part, l'utilisateur doit le voir.
      if (
        (body as { backupCodesRemaining?: unknown } | null)
          ?.backupCodesRemaining !== undefined
      ) {
        await this.events.record('backup_code_used', userId, req);
      }
      return;
    }
    // Ex. reset-password : pas de session, la réponse ne porte pas l'utilisateur.
    // Un login « mfa_required » n'a pas encore d'utilisateur : rien à journaliser.
    if ((body as { mfaRequired?: boolean } | null)?.mfaRequired) return;
    await this.events.recordForEmail(
      opts.success,
      (req.body as { email?: unknown } | undefined)?.email,
      req,
    );
  }

  private async onError(
    opts: SecurityEventOptions,
    req: Req,
    err: unknown,
  ): Promise<void> {
    if (!opts.failure) return;
    if (!(err instanceof HttpException)) return;
    const status = err.getStatus();
    if (status < 400 || status >= 500 || status === 429) return;
    if (req.user?.id) {
      await this.events.record(opts.failure, req.user.id, req);
      return;
    }
    await this.events.recordForEmail(
      opts.failure,
      (req.body as { email?: unknown } | undefined)?.email,
      req,
    );
  }
}
