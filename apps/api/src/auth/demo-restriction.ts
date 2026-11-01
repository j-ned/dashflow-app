import { ForbiddenError } from '../common/errors';
import type { AuthUser } from './auth-user';

/**
 * Refuse les actions qui modifient l'identité, les secrets ou le stockage du compte démo.
 *
 * La session démo est anonyme et partagée par tous les visiteurs : sans ce garde, n'importe qui
 * peut y activer E2EE avec ses propres clés (démo illisible pour les autres), y poser un avatar,
 * envoyer des invitations par mail depuis notre domaine ou écraser les fichiers du seed dans R2
 * (que le reset périodique ne restaure pas). À appliquer APRÈS l'authentification.
 */
export function assertNotDemo(user: AuthUser | undefined): void {
  if (user?.isDemo) {
    throw new ForbiddenError('Action indisponible sur le compte démo');
  }
}
