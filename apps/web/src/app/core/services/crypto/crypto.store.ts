import { computed, Injectable, signal } from '@angular/core';

const DB_NAME = 'dashflow-crypto';
const STORE_NAME = 'keys';
const MASTER_KEY_ID = 'master';
const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BITS = 256;

@Injectable({ providedIn: 'root' })
export class CryptoStore {
  private readonly _masterKey = signal<CryptoKey | null>(null);
  // Copie extractible en mémoire uniquement (jamais persistée) : nécessaire pour les rewraps
  // (changement de mot de passe, rotation de clé de récupération) qui n'ont pas toujours un
  // identifiant frais en main. Cf. audit F003 : _masterKey reste non-extractible pour que la
  // persistance (IndexedDB) ne puisse jamais être exportée par un script tiers.
  private _extractableMasterKey: CryptoKey | null = null;

  readonly isUnlocked = computed(() => !!this._masterKey());

  async generateMasterKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey({ name: 'AES-GCM', length: KEY_BITS }, true, [
      'encrypt',
      'decrypt',
    ]);
  }

  generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  }

  generateRecoveryKey(): string {
    return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  }

  async deriveWrappingKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey'],
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt.buffer as ArrayBuffer,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-KW', length: KEY_BITS },
      false,
      ['wrapKey', 'unwrapKey'],
    );
  }

  async deriveWrappingKeyFromRecovery(recoveryHex: string): Promise<CryptoKey> {
    const bytes = hexToBytes(recoveryHex);
    return crypto.subtle.importKey('raw', bytes, { name: 'AES-KW', length: KEY_BITS }, false, [
      'wrapKey',
      'unwrapKey',
    ]);
  }

  async wrapKey(masterKey: CryptoKey, wrappingKey: CryptoKey): Promise<string> {
    const wrapped = await crypto.subtle.wrapKey('raw', masterKey, wrappingKey, 'AES-KW');
    return bufferToBase64(wrapped);
  }

  async unwrapKey(
    wrappedBase64: string,
    wrappingKey: CryptoKey,
    extractable = false,
  ): Promise<CryptoKey> {
    const wrapped = base64ToBuffer(wrappedBase64);
    return crypto.subtle.unwrapKey(
      'raw',
      wrapped,
      wrappingKey,
      'AES-KW',
      { name: 'AES-GCM', length: KEY_BITS },
      extractable,
      ['encrypt', 'decrypt'],
    );
  }

  async encrypt(plaintext: string): Promise<string> {
    const key = this._masterKey();
    if (!key) throw new Error('CryptoStore is locked');
    return encryptWithKey(plaintext, key);
  }

  async decrypt(ciphertext: string): Promise<string> {
    const key = this._masterKey();
    if (!key) throw new Error('CryptoStore is locked');
    return decryptWithKey(ciphertext, key);
  }

  async encryptBuffer(data: ArrayBuffer): Promise<ArrayBuffer> {
    const key = this._masterKey();
    if (!key) throw new Error('CryptoStore is locked');
    return encryptBufferWithKey(data, key);
  }

  async decryptBuffer(data: ArrayBuffer): Promise<ArrayBuffer> {
    const key = this._masterKey();
    if (!key) throw new Error('CryptoStore is locked');
    return decryptBufferWithKey(data, key);
  }

  async unlock(password: string, saltHex: string, wrappedKeyBase64: string): Promise<void> {
    const salt = hexToBytes(saltHex);
    const wrappingKey = await this.deriveWrappingKey(password, salt);
    await this.setMasterKeyFromWrapped(wrappedKeyBase64, wrappingKey);
  }

  async unlockWithRecovery(recoveryHex: string, wrappedKeyBase64: string): Promise<void> {
    const wrappingKey = await this.deriveWrappingKeyFromRecovery(recoveryHex);
    await this.setMasterKeyFromWrapped(wrappedKeyBase64, wrappingKey);
  }

  async lock(): Promise<void> {
    this._masterKey.set(null);
    this._extractableMasterKey = null;
    await idbDelete(MASTER_KEY_ID);
  }

  /** Restaure la clé maîtresse (non-extractible) persistée en IndexedDB après un rechargement. */
  async restoreFromStorage(): Promise<boolean> {
    const key = await idbGet(MASTER_KEY_ID);
    if (!key) return false;
    this._masterKey.set(key);
    return true;
  }

  /** Clé pour encrypt/decrypt uniquement : non-extractible, jamais exportable en JS. */
  getMasterKey(): CryptoKey | null {
    return this._masterKey();
  }

  /**
   * Clé extractible pour les rewraps (changement de mot de passe, rotation de clé de
   * récupération). Disponible uniquement en mémoire depuis le dernier `unlock`/`unlockWithRecovery`
   * de la session courante ; `null` après un simple `restoreFromStorage` (rechargement de page) :
   * l'appelant doit alors redemander le mot de passe pour redériver la clé avant de rewrap.
   */
  getRewrappableMasterKey(): CryptoKey | null {
    return this._extractableMasterKey;
  }

  private async setMasterKeyFromWrapped(
    wrappedKeyBase64: string,
    wrappingKey: CryptoKey,
  ): Promise<void> {
    const [masterKey, extractableMasterKey] = await Promise.all([
      this.unwrapKey(wrappedKeyBase64, wrappingKey, false),
      this.unwrapKey(wrappedKeyBase64, wrappingKey, true),
    ]);
    this._masterKey.set(masterKey);
    this._extractableMasterKey = extractableMasterKey;
    await idbPut(MASTER_KEY_ID, masterKey);
  }
}

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error as Error);
  });
}

async function idbPut(id: string, value: CryptoKey): Promise<void> {
  const db = await openKeyDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error as Error);
    });
  } finally {
    db.close();
  }
}

async function idbGet(id: string): Promise<CryptoKey | undefined> {
  const db = await openKeyDb();
  try {
    return await new Promise<CryptoKey | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result as CryptoKey | undefined);
      request.onerror = () => reject(request.error as Error);
    });
  } finally {
    db.close();
  }
}

async function idbDelete(id: string): Promise<void> {
  const db = await openKeyDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error as Error);
    });
  } finally {
    db.close();
  }
}

export async function encryptWithKey(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  const combined = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), IV_BYTES);

  return bufferToBase64(combined.buffer);
}

export async function decryptWithKey(blob: string, key: CryptoKey): Promise<string> {
  const combined = new Uint8Array(base64ToBuffer(blob));
  const iv = combined.slice(0, IV_BYTES);
  const ciphertext = combined.slice(IV_BYTES);
  const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plainBuffer);
}

export async function encryptBufferWithKey(
  data: ArrayBuffer,
  key: CryptoKey,
): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);

  const combined = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), IV_BYTES);

  return combined.buffer;
}

export async function decryptBufferWithKey(
  data: ArrayBuffer,
  key: CryptoKey,
): Promise<ArrayBuffer> {
  const combined = new Uint8Array(data);
  const iv = combined.slice(0, IV_BYTES);
  const ciphertext = combined.slice(IV_BYTES);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
}

export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(hex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
}
