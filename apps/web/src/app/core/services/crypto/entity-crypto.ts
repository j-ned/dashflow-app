import { encryptWithKey, decryptWithKey } from './crypto.store';

export type ApiRow = Record<string, unknown> & { encryptedData?: string };

/**
 * Format des blobs d'entité :
 *  - historique : base64(iv ‖ ct), sans données associées — interchangeable entre lignes ;
 *  - `v2.` + base64(iv ‖ ct), AES-GCM avec données associées = id de la ligne : un blob déplacé
 *    sur une autre ligne (même table, même utilisateur) ne se déchiffre plus.
 * Un blob v2 exige donc de connaître l'id au chiffrement : à la création, le client le génère
 * (`crypto.randomUUID()`) et l'envoie au serveur, qui l'adopte.
 */
const V2_PREFIX = 'v2.';

export const rowAad = (rowId: string): string => `dashflow:row:${rowId}`;

export class BlobBindingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlobBindingError';
  }
}

export async function encryptEntity<T extends Record<string, unknown>>(
  data: T,
  cleartextKeys: readonly (keyof T)[],
  key: CryptoKey,
  options: { rowId?: string } = {},
): Promise<Record<string, unknown> & { encryptedData: string }> {
  const cleartext: Record<string, unknown> = {};
  const sensitive: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(data)) {
    if (cleartextKeys.includes(k as keyof T)) {
      cleartext[k] = v;
    } else {
      sensitive[k] = v;
    }
  }

  const json = JSON.stringify(sensitive);
  const encryptedData = options.rowId
    ? V2_PREFIX + (await encryptWithKey(json, key, rowAad(options.rowId)))
    : await encryptWithKey(json, key);
  return { ...cleartext, encryptedData };
}

export function isBoundBlob(encryptedData: string): boolean {
  return encryptedData.startsWith(V2_PREFIX);
}

export async function decryptEntity<T>(row: ApiRow, key: CryptoKey): Promise<T> {
  const { encryptedData, ...cleartext } = row;
  const blob = encryptedData!;
  let sensitiveJson: string;
  if (isBoundBlob(blob)) {
    const rowId = row['id'];
    if (typeof rowId !== 'string' || !rowId) {
      throw new BlobBindingError('Blob lié à une ligne sans id');
    }
    try {
      sensitiveJson = await decryptWithKey(blob.slice(V2_PREFIX.length), key, rowAad(rowId));
    } catch {
      // Clé fausse, ou blob déplacé sur une autre ligne : dans les deux cas on refuse.
      throw new BlobBindingError(`Blob illisible pour la ligne ${rowId}`);
    }
  } else {
    sensitiveJson = await decryptWithKey(blob, key);
  }
  const sensitive = JSON.parse(sensitiveJson);
  return { ...cleartext, ...sensitive } as T;
}

export async function decryptEntities<T>(rows: ApiRow[], key: CryptoKey): Promise<T[]> {
  return Promise.all(rows.map((row) => decryptEntity<T>(row, key)));
}
