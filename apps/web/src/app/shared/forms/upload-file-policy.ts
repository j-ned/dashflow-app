// Règles d'upload appliquées côté client AVANT chiffrement E2EE : une fois chiffré, le serveur
// ne peut plus vérifier le type réel du fichier, c'est donc ici que la whitelist s'applique.
// Miroir de nest-dashflow-app/src/common/files/validate-upload.ts (types + 10 Mo).

export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export const UPLOAD_ALLOWED_MIME_TYPES: readonly string[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export type UploadRejection = 'invalidType' | 'tooLarge';

export class UploadFileError extends Error {
  constructor(readonly reason: UploadRejection) {
    super(`upload rejected: ${reason}`);
    this.name = 'UploadFileError';
  }
}

/** Clé i18n à afficher pour une erreur d'upload, ou `null` si ce n'est pas une erreur de validation. */
export function uploadErrorKey(error: unknown): string | null {
  return error instanceof UploadFileError ? `shared.upload.${error.reason}` : null;
}

/**
 * MIME effectif d'un fichier : `file.type` si renseigné, sinon déduit de l'extension
 * (certains navigateurs/OS laissent `type` vide, notamment sur drag-and-drop).
 */
export function resolveUploadMimeType(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[extension] ?? '';
}

export function assertUploadable(file: File): void {
  if (!UPLOAD_ALLOWED_MIME_TYPES.includes(resolveUploadMimeType(file))) {
    throw new UploadFileError('invalidType');
  }
  if (file.size > UPLOAD_MAX_BYTES) {
    throw new UploadFileError('tooLarge');
  }
}
