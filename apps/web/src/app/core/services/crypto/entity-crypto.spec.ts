import { describe, it, expect, beforeAll } from 'vitest';
import {
  BlobBindingError,
  RowReferenceError,
  encryptEntity,
  decryptEntity,
  decryptEntities,
} from './entity-crypto';

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

describe('entity-crypto : références scellées dans le blob', () => {
  let key: CryptoKey;

  beforeAll(async () => {
    key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]);
  });

  const KEYS = ['id', 'userId', 'patientId', 'practitionerId', 'createdAt'] as const;
  const appointment = {
    id: 'rdv-1',
    userId: 'usr-1',
    patientId: 'pat-A',
    practitionerId: 'pra-1',
    createdAt: '2026-09-20T08:00:00.000Z',
    reason: 'Contrôle annuel',
  };
  const sealed = () => encryptEntity(appointment, KEYS, key, { rowId: appointment.id });

  it('roundtrip inchangé : l’entité rendue ne porte pas le champ technique __refs', async () => {
    const result = await decryptEntity<typeof appointment>(await sealed(), key);

    expect(result).toEqual(appointment);
    expect(result).not.toHaveProperty('__refs');
  });

  it.each([
    ['patientId', 'pat-B'],
    ['practitionerId', 'pra-2'],
  ])('%s ré-affecté en base → RowReferenceError', async (column, other) => {
    const row = { ...(await sealed()), [column]: other };

    await expect(decryptEntity(row, key)).rejects.toBeInstanceOf(RowReferenceError);
  });

  it('référence passée à null (ON DELETE SET NULL côté serveur) → acceptée', async () => {
    const row = { ...(await sealed()), practitionerId: null };

    const result = await decryptEntity<typeof appointment>(row, key);

    expect(result.practitionerId).toBeNull();
    expect(result.reason).toBe('Contrôle annuel');
  });

  it('ligne sans référence à l’écriture, rattachée ensuite en base → refusée', async () => {
    const orphan = { ...appointment, practitionerId: null };
    const row = await encryptEntity(orphan, KEYS, key, { rowId: orphan.id });

    await expect(decryptEntity({ ...row, practitionerId: 'pra-9' }, key)).rejects.toBeInstanceOf(
      RowReferenceError,
    );
  });

  it('id, userId et createdAt ne sont pas scellés (ils appartiennent au serveur)', async () => {
    const row = { ...(await sealed()), userId: 'usr-autre', createdAt: '2000-01-01T00:00:00.000Z' };

    await expect(decryptEntity(row, key)).resolves.toMatchObject({ reason: 'Contrôle annuel' });
  });

  it('refs d’URL (parent) : scellées sans figurer dans le corps envoyé', async () => {
    const tx = { id: 'tx-1', amount: 12.5, note: null };
    const enc = await encryptEntity(tx, ['id'], key, {
      rowId: tx.id,
      refs: { accountId: 'acc-A' },
    });

    expect(enc).not.toHaveProperty('accountId');
    await expect(decryptEntity({ ...enc, accountId: 'acc-A' }, key)).resolves.toMatchObject({
      amount: 12.5,
    });
    await expect(decryptEntity({ ...enc, accountId: 'acc-B' }, key)).rejects.toBeInstanceOf(
      RowReferenceError,
    );
  });

  it('blob v2 écrit avant (sans __refs) : toujours lisible, quelle que soit la référence', async () => {
    const legacy = await encryptEntity({ id: 'rdv-1', reason: 'x' }, ['id'], key, {
      rowId: 'rdv-1',
    });

    await expect(decryptEntity({ ...legacy, patientId: 'pat-Z' }, key)).resolves.toMatchObject({
      reason: 'x',
    });
  });

  it('liste : la ligne ré-affectée est écartée, les autres restent ; un blob déplacé reste bloquant', async () => {
    const good = await sealed();
    const tampered = { ...(await sealed()), id: 'rdv-1', patientId: 'pat-B' };

    const list = await decryptEntities<typeof appointment>([good, tampered], key);
    expect(list).toHaveLength(1);
    expect(list[0].patientId).toBe('pat-A');

    const moved = { ...good, id: 'rdv-2' };
    await expect(decryptEntities([good, moved], key)).rejects.toBeInstanceOf(BlobBindingError);
  });
});
