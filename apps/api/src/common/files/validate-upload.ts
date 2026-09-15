import { BadRequestException } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';

/** Types de fichiers acceptés en upload (documents médicaux, fiches de paie, justificatifs). */
const ALLOWED_UPLOAD_MIME_TYPES: readonly string[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

/**
 * MIME déclaré par le client pour un fichier chiffré côté client (E2EE). Accepté uniquement
 * via `UploadPolicy` pour les comptes dont `encryption_version = 1`.
 */
export const OPAQUE_MIME_TYPE = 'application/octet-stream';

/** Taille max d'un fichier utilisateur (miroir de la règle côté client). */
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Limite multer : le client valide `UPLOAD_MAX_BYTES` sur le fichier EN CLAIR ; en E2EE le blob
 * reçu porte en plus l'en-tête de format (≤ 260 octets), l'IV (12) et le tag GCM (16).
 * Sans cette marge, un fichier de 10 Mo tout juste valide côté client serait refusé ici.
 */
export const UPLOAD_MULTER_LIMIT_BYTES = UPLOAD_MAX_BYTES + 1024;

/**
 * Vérifie qu'un fichier uploadé en clair est bien du type déclaré : whitelist sur le `mimetype`
 * (déclaratif, fourni par le client) ET vérification par magic-bytes du contenu réel.
 * Un `mimetype` usurpé (ex. exécutable renommé en `.pdf`) est rejeté même s'il passe la
 * whitelist déclarative.
 */
export async function assertValidUpload(file: {
  buffer: Buffer;
  mimetype: string;
}): Promise<void> {
  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.mimetype)) {
    throw new BadRequestException('Type de fichier non autorisé');
  }
  const detected = await fileTypeFromBuffer(file.buffer);
  if (!detected || !ALLOWED_UPLOAD_MIME_TYPES.includes(detected.mime)) {
    throw new BadRequestException(
      'Contenu du fichier invalide (type réel non autorisé)',
    );
  }
}
