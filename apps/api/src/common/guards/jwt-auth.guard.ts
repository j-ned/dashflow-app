import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { TokenService } from '../../auth/token.service';
import { SessionAuthenticator } from '../../auth/session-authenticator';
import type { AuthUser } from '../../auth/auth-user';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';

/** Adaptateur Nest de SessionAuthenticator : attache `request.user`. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly sessions: SessionAuthenticator;

  constructor(token: TokenService, @Inject(DRIZZLE) db: DrizzleDB) {
    this.sessions = new SessionAuthenticator(token, db);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    req.user = await this.sessions.authenticate(
      req.cookies as Record<string, string> | undefined,
    );
    return true;
  }
}
