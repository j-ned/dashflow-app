import { Injectable } from '@nestjs/common';
import { AuthRepository } from '../../auth/auth.repository';
import { assertValidUpload, OPAQUE_MIME_TYPE } from './validate-upload';

export type UploadedFileLike = { buffer: Buffer; mimetype: string };

/**
 * Politique d'upload dépendante du mode de chiffrement du compte.
 *
 * - Compte E2EE (`encryption_version = 1`) : le client chiffre le fichier (AES-GCM) avant envoi
 *   et le déclare `application/octet-stream`. Le contenu est opaque par construction : impossible
 *   (et inutile) de vérifier des magic-bytes. Seule la taille est bornée (multer `fileSize`).
 * - Compte en clair : whitelist MIME + magic-bytes (`assertValidUpload`), inchangé.
 *
 * Un compte en clair qui enverrait `application/octet-stream` est refusé : la validation
 * par contenu ne doit jamais pouvoir être contournée en déclarant un blob opaque.
 */
@Injectable()
export class UploadPolicy {
  constructor(private readonly repo: AuthRepository) {}

  async assertValid(userId: string, file: UploadedFileLike): Promise<void> {
    if (file.mimetype === OPAQUE_MIME_TYPE) {
      const user = await this.repo.findById(userId);
      if (user?.encryptionVersion === 1) return;
    }
    await assertValidUpload(file);
  }
}
