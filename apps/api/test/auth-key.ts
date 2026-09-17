import { createHash } from 'node:crypto';

/**
 * Tient lieu de la clé d'authentification que le client dérive du mot de passe : 32 octets en
 * hex, seul format accepté par l'API pour un nouveau secret de connexion.
 */
export const authKey = (password: string): string =>
  createHash('sha256').update(password).digest('hex');
