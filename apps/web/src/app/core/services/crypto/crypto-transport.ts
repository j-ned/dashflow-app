import { from, Observable, switchMap } from 'rxjs';
import {
  ApiRow,
  BlobBindingError,
  encryptEntity,
  decryptEntity,
  decryptEntities,
} from './entity-crypto';
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

export type MutateOptions = {
  /** Ligne existante (PUT/PATCH) : le blob est lié à cet id. Absent = création. */
  rowId?: string;
};

/**
 * Chiffre `data` puis envoie. À la création (pas de `rowId`), génère l'id de la ligne côté client,
 * l'inclut dans le corps et lie le blob à cet id ; le serveur doit renvoyer une ligne portant le
 * même id (sinon le blob serait illisible : on refuse plutôt que d'afficher du vide).
 */
export function mutateEncrypted<T>(
  data: Record<string, unknown>,
  cleartextKeys: readonly string[],
  key: CryptoKey | null,
  call: (body: Record<string, unknown>) => Observable<ApiRow>,
  options: MutateOptions = {},
): Observable<T> {
  if (!key) return call(data) as Observable<T>;
  const rowId = options.rowId ?? crypto.randomUUID();
  const creating = options.rowId === undefined;
  return from(encryptEntity(data, cleartextKeys, key, { rowId })).pipe(
    switchMap((enc) => call(creating ? { ...enc, id: rowId } : enc)),
    switchMap((row) => {
      if (creating && row['id'] !== rowId) {
        throw new BlobBindingError(
          "Le serveur n'a pas adopté l'id de la ligne : version de l'API trop ancienne",
        );
      }
      return row.encryptedData ? from(decryptEntity<T>(row, key)) : from([row as T]);
    }),
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
