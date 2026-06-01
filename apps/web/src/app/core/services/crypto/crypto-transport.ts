import { from, Observable, switchMap } from 'rxjs';
import { ApiRow, encryptEntity, decryptEntity, decryptEntities } from './entity-crypto';
import { decryptFile } from './file-crypto';

/**
 * Transport helpers shared by the HTTP gateways. They centralise the
 * "encrypt-on-write / decrypt-on-read when a master key is present" branching
 * (E2EE) versus the plaintext path (demo / non-encrypted accounts).
 *
 * `mapPlain` coerces a plaintext row (postgres returns numerics as strings);
 * the decrypted path already yields parsed JSON values, so it is not applied there.
 */

const identity = <T>(row: ApiRow): T => row as T;

/** Decrypt a list response, or coerce the plaintext rows when E2EE is off. */
export function decryptList<T>(
  rows$: Observable<ApiRow[]>,
  key: CryptoKey | null,
  mapPlain: (row: ApiRow) => T = identity,
): Observable<T[]> {
  return rows$.pipe(
    switchMap((rows) =>
      !key || !rows.some((r) => r.encryptedData)
        ? from([rows.map(mapPlain)])
        : from(decryptEntities<T>(rows, key)),
    ),
  );
}

/** Decrypt a single-row response, or coerce the plaintext row when E2EE is off. */
export function decryptOne<T>(
  row$: Observable<ApiRow>,
  key: CryptoKey | null,
  mapPlain: (row: ApiRow) => T = identity,
): Observable<T> {
  return row$.pipe(
    switchMap((row) =>
      !key || !row.encryptedData ? from([mapPlain(row)]) : from(decryptEntity<T>(row, key)),
    ),
  );
}

/**
 * Encrypt an entity's sensitive fields (when E2EE is on), send it through `call`
 * (POST/PUT/PATCH), then decrypt the returned row. With E2EE off, sends as-is.
 */
export function mutateEncrypted<T>(
  data: Record<string, unknown>,
  cleartextKeys: readonly string[],
  key: CryptoKey | null,
  call: (body: Record<string, unknown>) => Observable<ApiRow>,
): Observable<T> {
  if (!key) return call(data) as Observable<T>;
  return from(encryptEntity(data, cleartextKeys, key)).pipe(
    switchMap((enc) => call(enc)),
    switchMap((row) => (row.encryptedData ? from(decryptEntity<T>(row, key)) : from([row as T]))),
  );
}

/** Decrypt a downloaded blob when it was stored encrypted (octet-stream), else pass through. */
export function decryptBlob(blob$: Observable<Blob>, key: CryptoKey | null, mimeType: string): Observable<Blob> {
  return blob$.pipe(
    switchMap((blob) =>
      key && blob.type === 'application/octet-stream' ? from(decryptFile(blob, key, mimeType)) : from([blob]),
    ),
  );
}
