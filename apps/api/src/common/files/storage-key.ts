import { NotFoundException } from '@nestjs/common';

export type StoragePrefix = 'documents' | 'prescriptions' | 'payslips';

/**
 * Garantit qu'une clé R2 lue en base appartient bien à `userId` avant de la streamer ou de la
 * supprimer. Les clés sont générées côté serveur (`StorageService.*Key`), mais ce contrôle
 * ferme la porte à toute ligne dont la clé aurait été posée autrement (ancien DTO qui acceptait
 * `fileUrl` / `documentUrl` du client, import, incident) : le contrôle d'accès repose sur une
 * règle, pas sur l'entropie des UUID.
 */
export function assertOwnedStorageKey(
  userId: string,
  key: string,
  prefix: StoragePrefix,
): string {
  if (!key.startsWith(`${prefix}/${userId}/`) || key.includes('..')) {
    throw new NotFoundException('Fichier introuvable');
  }
  return key;
}
