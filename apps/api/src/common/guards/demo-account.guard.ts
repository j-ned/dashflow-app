import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthUser } from '../decorators/current-user.decorator';

/**
 * Refuse les actions qui modifient l'identité, les secrets ou le stockage du compte démo.
 *
 * La session démo est anonyme et partagée par tous les visiteurs : sans ce garde, n'importe qui
 * peut y activer E2EE avec ses propres clés (démo illisible pour les autres), y poser un avatar,
 * envoyer des invitations par mail depuis notre domaine ou écraser les fichiers du seed dans R2
 * (que le reset périodique ne restaure pas). À placer APRÈS JwtAuthGuard.
 */
@Injectable()
export class DemoAccountGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (user?.isDemo) {
      throw new ForbiddenException('Action indisponible sur le compte démo');
    }
    return true;
  }
}
