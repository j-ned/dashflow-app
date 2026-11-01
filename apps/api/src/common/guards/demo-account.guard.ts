import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { AuthUser } from '../../auth/auth-user';
import { assertNotDemo } from '../../auth/demo-restriction';

/** Adaptateur Nest de assertNotDemo (à placer APRÈS JwtAuthGuard). */
@Injectable()
export class DemoAccountGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    assertNotDemo(
      context.switchToHttp().getRequest<{ user?: AuthUser }>().user,
    );
    return true;
  }
}
