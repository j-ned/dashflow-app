import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { TokenService } from '../../auth/token.service';
import { SESSION_COOKIE } from '../../auth/cookie';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly token: TokenService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: unknown }>();
    const raw = (req.cookies as Record<string, string> | undefined)?.[
      SESSION_COOKIE
    ];
    if (!raw) throw new UnauthorizedException('Non authentifié');
    try {
      const payload = await this.token.verify(raw);
      (req as Request & { user: unknown }).user = {
        id: payload.sub,
        email: payload.email,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Session invalide');
    }
  }
}
