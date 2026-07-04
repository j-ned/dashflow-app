import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { CSRF_COOKIE, CSRF_HEADER } from '../../auth/cookie';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const cookie = (req.cookies as Record<string, string> | undefined)?.[
      CSRF_COOKIE
    ];
    const header = req.headers[CSRF_HEADER];
    if (!cookie || !header || cookie !== header) {
      throw new ForbiddenException('Jeton CSRF invalide');
    }
    return true;
  }
}
