import { encryptWithKey, decryptWithKey } from './crypto.store';

export type ApiRow = Record<string, unknown> & { encryptedData?: string };

/**
 * Format des blobs d'entité :
 *  - historique : base64(iv ‖ ct), sans données associées — interchangeable entre lignes ;
 *  - `v2.` + base64(iv ‖ ct), AES-GCM avec données associées = id de la ligne : un blob déplacé
 *    sur une autre ligne (même table, même utilisateur) ne se déchiffre plus.
 * Un blob v2 exige donc de connaître l'id au chiffrement : à la création, le client le génère
 * (`crypto.randomUUID()`) et l'envoie au serveur, qui l'adopte.
 *
 * Références scellées : les colonnes laissées en clair (clés étrangères, `direction`) sont recopiées
 * dans le blob sous `__refs`. À la lecture, une ligne qui pointe ailleurs que ce qui a été scellé est
 * refusée : quelqu'un qui écrit en base ne peut plus rattacher un rendez-vous à un autre patient.
 * Une référence passée à `null` reste acceptée : c'est ce que fait le serveur (`ON DELETE SET NULL`)
 * quand la cible est supprimée ; il ne ré-affecte jamais une ligne de lui-même.
 * Les blobs écrits avant n'ont pas de `__refs` : ils sont scellés à leur prochaine écriture.
 */
const V2_PREFIX = 'v2.';
const REFS_KEY = '__refs';
// Jamais scellées : l'id l'est déjà par les données associées, le reste appartient au serveur.
const UNSEALED_KEYS: ReadonlySet<string> = new Set(['id', 'userId', 'createdAt', 'updatedAt']);

type SealedRefs = Record<string, string | number | boolean | null>;

const isSealable = (v: unknown): v is string | number | boolean | null =>
  v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';

export const rowAad = (rowId: string): string => `dashflow:row:${rowId}`;

export class BlobBindingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlobBindingError';
  }
}

/** La ligne pointe vers une autre référence que celle scellée dans son blob. */
export class RowReferenceError extends BlobBindingError {
  constructor(rowId: string, column: string) {
    super(`Ligne ${rowId} : la référence « ${column} » ne correspond pas au blob`);
    this.name = 'RowReferenceError';
  }
}

export type EncryptOptions = {
  rowId?: string;
  /** Références portées par l'URL et non par le corps (compte d'une opération, enveloppe…). */
  refs?: Readonly<Record<string, string>>;
};

export async function encryptEntity<T extends Record<string, unknown>>(
  data: T,
  cleartextKeys: readonly (keyof T)[],
  key: CryptoKey,
  options: EncryptOptions = {},
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

  if (options.rowId) {
    const refs: SealedRefs = { ...options.refs };
    for (const [k, v] of Object.entries(cleartext)) {
      if (!UNSEALED_KEYS.has(k) && isSealable(v)) refs[k] = v;
    }
    if (Object.keys(refs).length > 0) sensitive[REFS_KEY] = refs;
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
  const { [REFS_KEY]: refs, ...sensitive } = JSON.parse(sensitiveJson) as Record<string, unknown>;
  if (refs && typeof refs === 'object') assertSealedRefs(row, refs as SealedRefs);
  return { ...cleartext, ...sensitive } as T;
}

function assertSealedRefs(row: ApiRow, refs: SealedRefs): void {
  for (const [column, sealed] of Object.entries(refs)) {
    const current = row[column] ?? null;
    if (current !== null && current !== sealed) {
      throw new RowReferenceError(String(row['id']), column);
    }
  }
}

/**
 * Une ligne dont les références ont été modifiées en base est écartée (et signalée) sans faire
 * tomber la liste entière. Toute autre erreur (clé fausse, blob déplacé) reste bloquante.
 */
export async function decryptEntities<T>(rows: ApiRow[], key: CryptoKey): Promise<T[]> {
  const settled = await Promise.allSettled(rows.map((row) => decryptEntity<T>(row, key)));
  const entities: T[] = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') entities.push(result.value);
    else if (result.reason instanceof RowReferenceError)
      console.error(`[E2EE] ${result.reason.message}, exclue.`);
    else throw result.reason;
  }
  return entities;
}
