import { encryptWithKey, decryptWithKey } from './crypto.store';

/**
 * Encrypts an entity's sensitive fields into an `encryptedData` blob.
 * Cleartext keys (foreign keys, structural IDs) are preserved as-is.
 *
 * @param data - The full entity object
 * @param cleartextKeys - Keys to keep in cleartext (e.g. 'id', 'userId', 'memberId')
 * @param key - The AES-GCM CryptoKey
 * @returns Object with cleartext fields + `encryptedData` string
 */
export async function encryptEntity<T extends Record<string, unknown>>(
  data: T,
  cleartextKeys: readonly (keyof T)[],
  key: CryptoKey,
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

  const encryptedData = await encryptWithKey(JSON.stringify(sensitive), key);
  return { ...cleartext, encryptedData };
}

/**
 * Decrypts an entity from a row containing `encryptedData` + cleartext fields.
 *
 * @param row - The DB row with `encryptedData` and cleartext fields
 * @param key - The AES-GCM CryptoKey
 * @returns The full entity object with all fields restored
 */
export async function decryptEntity<T>(
  row: Record<string, unknown> & { encryptedData: string },
  key: CryptoKey,
): Promise<T> {
  const { encryptedData, ...cleartext } = row;
  const sensitiveJson = await decryptWithKey(encryptedData, key);
  const sensitive = JSON.parse(sensitiveJson);
  return { ...cleartext, ...sensitive } as T;
}

/**
 * Batch decrypt multiple entities.
 */
export async function decryptEntities<T>(
  rows: Array<Record<string, unknown> & { encryptedData: string }>,
  key: CryptoKey,
): Promise<T[]> {
  return Promise.all(rows.map((row) => decryptEntity<T>(row, key)));
}
