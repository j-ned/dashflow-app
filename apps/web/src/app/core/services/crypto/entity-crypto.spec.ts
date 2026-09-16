import { describe, it, expect, beforeAll } from 'vitest';
import { BlobBindingError, encryptEntity, decryptEntity, decryptEntities } from './entity-crypto';

describe('entity-crypto', () => {
  let key: CryptoKey;

  beforeAll(async () => {
    key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]);
  });

  const CLEARTEXT_KEYS = ['id', 'userId'] as const;

  const entity = {
    id: 'env-1',
    userId: 'usr-42',
    name: 'Épargne vacances',
    balance: 1500,
    secret: 'confidentiel',
  };

  it('should separate cleartext keys from sensitive data', async () => {
    const encrypted = await encryptEntity(entity, CLEARTEXT_KEYS, key);

    expect(encrypted['id']).toBe('env-1');
    expect(encrypted['userId']).toBe('usr-42');
    expect(encrypted['encryptedData']).toBeTypeOf('string');
    expect(encrypted).not.toHaveProperty('name');
    expect(encrypted).not.toHaveProperty('balance');
    expect(encrypted).not.toHaveProperty('secret');
  });

  it('should roundtrip: encrypt then decrypt restores original entity', async () => {
    const encrypted = await encryptEntity(entity, CLEARTEXT_KEYS, key);
    const decrypted = await decryptEntity<typeof entity>(encrypted, key);

    expect(decrypted).toEqual(entity);
  });

  it('should batch decrypt multiple entities', async () => {
    const entities = [
      { id: '1', userId: 'u1', name: 'A', balance: 100 },
      { id: '2', userId: 'u2', name: 'B', balance: 200 },
      { id: '3', userId: 'u3', name: 'C', balance: 300 },
    ];

    const rows = await Promise.all(entities.map((e) => encryptEntity(e, CLEARTEXT_KEYS, key)));
    const decrypted = await decryptEntities<(typeof entities)[number]>(rows, key);

    expect(decrypted).toEqual(entities);
  });

  it('should handle entity with null and array values', async () => {
    const complex = { id: 'x', userId: 'u', tags: ['a', 'b'], note: null };
    const encrypted = await encryptEntity(complex, CLEARTEXT_KEYS, key);
    const decrypted = await decryptEntity<typeof complex>(encrypted, key);

    expect(decrypted).toEqual(complex);
  });
});

describe('entity-crypto : blobs liés à leur ligne (v2)', () => {
  let key: CryptoKey;
  beforeAll(async () => {
    key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]);
  });
  const KEYS = ['id'] as const;

  it('avec rowId : préfixe v2., et roundtrip sur la même ligne', async () => {
    const enc = await encryptEntity({ id: 'r1', amount: 42 }, KEYS, key, { rowId: 'r1' });
    expect(enc.encryptedData.startsWith('v2.')).toBe(true);
    expect(await decryptEntity({ id: 'r1', encryptedData: enc.encryptedData }, key)).toEqual({
      id: 'r1',
      amount: 42,
    });
  });

  it('un blob v2 déplacé sur une autre ligne ne se déchiffre pas (BlobBindingError)', async () => {
    const enc = await encryptEntity({ id: 'r1', amount: 42 }, KEYS, key, { rowId: 'r1' });
    await expect(
      decryptEntity({ id: 'r2', encryptedData: enc.encryptedData }, key),
    ).rejects.toBeInstanceOf(BlobBindingError);
    await expect(decryptEntity({ encryptedData: enc.encryptedData }, key)).rejects.toBeInstanceOf(
      BlobBindingError,
    );
  });

  it('un blob historique (sans préfixe) se déchiffre toujours, quelle que soit la ligne', async () => {
    const legacy = await encryptEntity({ id: 'r1', amount: 1 }, KEYS, key);
    expect(legacy.encryptedData.startsWith('v2.')).toBe(false);
    expect(await decryptEntity({ id: 'autre', encryptedData: legacy.encryptedData }, key)).toEqual({
      id: 'autre',
      amount: 1,
    });
  });
});
