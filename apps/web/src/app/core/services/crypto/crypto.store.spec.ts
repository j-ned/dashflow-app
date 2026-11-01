import { beforeEach, describe, expect, it } from 'vitest';
import { CryptoStore, bytesToHex } from './crypto.store';

async function setupUnlockedStore(password = 'correct-horse-battery-staple') {
  const store = new CryptoStore();
  const masterKey = await store.generateMasterKey();
  const salt = store.generateSalt();
  const wrappingKey = await store.deriveWrappingKey(password, salt);
  const wrappedKeyBase64 = await store.wrapKey(masterKey, wrappingKey);
  const saltHex = bytesToHex(salt);
  await store.unlock(password, saltHex, wrappedKeyBase64);
  return { store, password, saltHex, wrappedKeyBase64 };
}

function clearKeyDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('dashflow-crypto');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error as Error);
    request.onblocked = () => resolve();
  });
}

describe('CryptoStore', () => {
  // fake-indexeddb persiste entre les tests (contrairement à sessionStorage en prod) :
  // repartir d'une base vide pour ne pas laisser une clé d'un test précédent fausser les assertions.
  beforeEach(() => clearKeyDb());

  it('given unlock avec le bon mot de passe, when encrypt puis decrypt, then retrouve le texte original', async () => {
    const { store } = await setupUnlockedStore();

    const ciphertext = await store.encrypt('secret médical');
    const plaintext = await store.decrypt(ciphertext);

    expect(plaintext).toBe('secret médical');
  });

  it('given une clé maîtresse déverrouillée, when getMasterKey, then la clé est non-extractible', async () => {
    const { store } = await setupUnlockedStore();

    const masterKey = store.getMasterKey();

    expect(masterKey?.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', masterKey!)).rejects.toThrow();
  });

  it('given un unlock frais, when getRewrappableMasterKey, then la clé est extractible et exploitable par wrapKey', async () => {
    const { store } = await setupUnlockedStore();
    const rewrappable = store.getRewrappableMasterKey();
    expect(rewrappable?.extractable).toBe(true);

    const newSalt = store.generateSalt();
    const newWrappingKey = await store.deriveWrappingKey('nouveau-mot-de-passe-12', newSalt);

    await expect(store.wrapKey(rewrappable!, newWrappingKey)).resolves.toEqual(expect.any(String));
  });

  it('given une instance fraîche restaurée depuis le stockage, when getRewrappableMasterKey, then retourne null', async () => {
    await setupUnlockedStore();

    const restored = new CryptoStore();
    const ok = await restored.restoreFromStorage();

    expect(ok).toBe(true);
    expect(restored.getRewrappableMasterKey()).toBeNull();
    expect(restored.getMasterKey()).not.toBeNull();
    // La clé restaurée reste utilisable pour chiffrer/déchiffrer malgré l'absence de copie extractible.
    const ciphertext = await restored.encrypt('toujours utilisable');
    expect(await restored.decrypt(ciphertext)).toBe('toujours utilisable');
  });

  it('given un lock, when restoreFromStorage depuis une autre instance, then ne restaure plus rien', async () => {
    const { store } = await setupUnlockedStore();
    await store.lock();

    const restored = new CryptoStore();
    const ok = await restored.restoreFromStorage();

    expect(ok).toBe(false);
    expect(restored.getMasterKey()).toBeNull();
  });

  it('given unlockWithRecovery, when getRewrappableMasterKey, then la clé de récupération donne aussi une copie extractible', async () => {
    const store = new CryptoStore();
    const masterKey = await store.generateMasterKey();
    const recoveryHex = store.generateRecoveryKey();
    const recoveryWrappingKey = await store.deriveWrappingKeyFromRecovery(recoveryHex);
    const wrappedKeyBase64 = await store.wrapKey(masterKey, recoveryWrappingKey);

    await store.unlockWithRecovery(recoveryHex, wrappedKeyBase64);

    expect(store.getMasterKey()?.extractable).toBe(false);
    expect(store.getRewrappableMasterKey()?.extractable).toBe(true);
  });
});
