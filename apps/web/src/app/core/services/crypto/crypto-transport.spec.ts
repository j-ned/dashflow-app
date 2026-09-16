import { describe, it, expect, beforeAll } from 'vitest';
import { firstValueFrom, of } from 'rxjs';
import { mutateEncrypted } from './crypto-transport';
import { ApiRow, BlobBindingError, decryptEntity } from './entity-crypto';

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
