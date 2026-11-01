import { describe, it, expect, beforeAll } from 'vitest';
import { firstValueFrom, of } from 'rxjs';
import { decryptList, decryptOne, mutateEncrypted } from './crypto-transport';
import { ApiRow, BlobBindingError, decryptEntity, encryptEntity } from './entity-crypto';

describe('mutateEncrypted', () => {
  let key: CryptoKey;
  beforeAll(async () => {
    key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]);
  });
  const KEYS = ['id', 'memberId'] as const;

  it('création : génère un id UUID, l’envoie en clair, lie le blob à cet id et déchiffre la réponse', async () => {
    let sent: Record<string, unknown> | undefined;
    const result = await firstValueFrom(
      mutateEncrypted<{ id: string; name: string }>(
        { name: 'Léa', memberId: null },
        KEYS,
        key,
        (body) => {
          sent = body;
          return of({
            id: body['id'],
            memberId: null,
            encryptedData: body['encryptedData'],
          } as ApiRow);
        },
      ),
    );
    expect(sent!['id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent!['name']).toBeUndefined();
    expect((sent!['encryptedData'] as string).startsWith('v2.')).toBe(true);
    expect(result).toEqual({ id: sent!['id'], memberId: null, name: 'Léa' });
  });

  it('création : si le serveur renvoie un autre id (API ancienne), refuse plutôt qu’un blob illisible', async () => {
    await expect(
      firstValueFrom(
        mutateEncrypted({ name: 'x' }, KEYS, key, (body) =>
          of({ id: 'autre-id', encryptedData: body['encryptedData'] } as ApiRow),
        ),
      ),
    ).rejects.toBeInstanceOf(BlobBindingError);
  });

  it('mise à jour : rowId fourni, pas d’id ajouté au corps, blob lié à la ligne', async () => {
    let sent: Record<string, unknown> | undefined;
    await firstValueFrom(
      mutateEncrypted(
        { name: 'Léa 2' },
        KEYS,
        key,
        (body) => {
          sent = body;
          return of({ id: 'r1', encryptedData: body['encryptedData'] } as ApiRow);
        },
        { rowId: 'r1' },
      ),
    );
    expect(sent!['id']).toBeUndefined();
    expect(
      await decryptEntity({ id: 'r1', encryptedData: sent!['encryptedData'] as string }, key),
    ).toEqual({ id: 'r1', name: 'Léa 2' });
  });

  it('sans clé (compte en clair) : corps envoyé tel quel, aucun id généré', async () => {
    let sent: Record<string, unknown> | undefined;
    await firstValueFrom(
      mutateEncrypted({ name: 'x' }, KEYS, null, (body) => {
        sent = body;
        return of({ id: 's1', name: 'x' } as ApiRow);
      }),
    );
    expect(sent).toEqual({ name: 'x' });
  });
});

describe('decryptList / decryptOne : conversion des lignes', () => {
  let key: CryptoKey;
  beforeAll(async () => {
    key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]);
  });
  type Tx = { id: string; amount: number };
  const coerce = (row: ApiRow): Tx => ({
    ...(row as unknown as Tx),
    amount: Number(row['amount']),
  });
  // Blob d'un compte passé du clair au chiffré : le montant `numeric` y est resté en chaîne.
  const migratedRow = () =>
    encryptEntity({ id: 't1', amount: '42.50' }, ['id'], key, { rowId: 't1' });

  it('liste chiffrée : le convertisseur s’applique aussi après déchiffrement', async () => {
    const list = await firstValueFrom(decryptList<Tx>(of([await migratedRow()]), key, coerce));

    expect(list).toEqual([{ id: 't1', amount: 42.5 }]);
  });

  it('ligne chiffrée seule : idem', async () => {
    const tx = await firstValueFrom(decryptOne<Tx>(of(await migratedRow()), key, coerce));

    expect(tx.amount).toBe(42.5);
  });

  it('lignes en clair : comportement inchangé', async () => {
    const list = await firstValueFrom(
      decryptList<Tx>(of([{ id: 't2', amount: '7.00' } as ApiRow]), null, coerce),
    );

    expect(list).toEqual([{ id: 't2', amount: 7 }]);
  });
});
