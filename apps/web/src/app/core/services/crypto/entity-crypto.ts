import { encryptWithKey, decryptWithKey } from './crypto.store';

export type ApiRow = Record<string, unknown> & { encryptedData?: string };

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

export async function decryptEntity<T>(row: ApiRow, key: CryptoKey): Promise<T> {
  const { encryptedData, ...cleartext } = row;
  const sensitiveJson = await decryptWithKey(encryptedData!, key);
  const sensitive = JSON.parse(sensitiveJson);
  return { ...cleartext, ...sensitive } as T;
}

export async function decryptEntities<T>(rows: ApiRow[], key: CryptoKey): Promise<T[]> {
  return Promise.all(rows.map((row) => decryptEntity<T>(row, key)));
}
