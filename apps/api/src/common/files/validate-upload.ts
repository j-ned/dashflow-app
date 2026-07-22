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
 * Vérifie qu'un fichier uploadé est bien du type déclaré : whitelist sur le `mimetype`
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
