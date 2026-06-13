import { from, Observable, switchMap } from 'rxjs';
import { ApiRow, encryptEntity, decryptEntity, decryptEntities } from './entity-crypto';
import { decryptFile } from './file-crypto';

const identity = <T>(row: ApiRow): T => row as T;

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
