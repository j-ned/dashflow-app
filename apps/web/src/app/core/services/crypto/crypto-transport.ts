import { from, Observable, switchMap } from 'rxjs';
import { ApiRow, encryptEntity, decryptEntity, decryptEntities } from './entity-crypto';
import { decryptFile } from './file-crypto';

// E2EE branching: mapPlain coerces plaintext rows (postgres returns numerics as strings); decrypted path skips it because JSON.parse already yields the right types.

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

// Encrypt before sending and decrypt the response when E2EE is on; pass through unchanged when off.
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
export function decryptBlob(
  blob$: Observable<Blob>,
  key: CryptoKey | null,
  mimeType: string,
): Observable<Blob> {
  return blob$.pipe(
    switchMap((blob) =>
      key && blob.type === 'application/octet-stream'
        ? from(decryptFile(blob, key, mimeType))
        : from([blob]),
    ),
  );
}
