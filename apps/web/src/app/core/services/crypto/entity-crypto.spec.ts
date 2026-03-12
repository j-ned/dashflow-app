import { describe, it, expect, beforeAll } from 'vitest';
import { encryptEntity, decryptEntity, decryptEntities } from './entity-crypto';

describe('entity-crypto', () => {
  let key: CryptoKey;

  beforeAll(async () => {
    key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
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
    const decrypted = await decryptEntity<typeof entity>(encrypted as any, key);

    expect(decrypted).toEqual(entity);
  });

  it('should batch decrypt multiple entities', async () => {
    const entities = [
      { id: '1', userId: 'u1', name: 'A', balance: 100 },
      { id: '2', userId: 'u2', name: 'B', balance: 200 },
      { id: '3', userId: 'u3', name: 'C', balance: 300 },
    ];

    const rows = await Promise.all(
      entities.map((e) => encryptEntity(e, CLEARTEXT_KEYS, key)),
    );
    const decrypted = await decryptEntities<(typeof entities)[number]>(rows as any, key);

    expect(decrypted).toEqual(entities);
  });

  it('should handle entity with null and array values', async () => {
    const complex = { id: 'x', userId: 'u', tags: ['a', 'b'], note: null };
    const encrypted = await encryptEntity(complex, CLEARTEXT_KEYS, key);
    const decrypted = await decryptEntity<typeof complex>(encrypted as any, key);

    expect(decrypted).toEqual(complex);
  });
});
