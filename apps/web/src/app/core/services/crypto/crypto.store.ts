import { computed, Injectable, signal } from '@angular/core';

const SESSION_KEY = 'e2ee_master_key';
const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BITS = 256;

@Injectable({ providedIn: 'root' })
export class CryptoStore {
  private readonly _masterKey = signal<CryptoKey | null>(null);

  readonly isUnlocked = computed(() => !!this._masterKey());

  // ── Key Generation ──

  async generateMasterKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
      { name: 'AES-GCM', length: KEY_BITS },
      true,
      ['encrypt', 'decrypt'],
    );
  }

  generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  }

  generateRecoveryKey(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  // ── Key Derivation ──

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
      { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-KW', length: KEY_BITS },
      false,
      ['wrapKey', 'unwrapKey'],
    );
  }

  async deriveWrappingKeyFromRecovery(recoveryHex: string): Promise<CryptoKey> {
    const bytes = new Uint8Array(recoveryHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
    return crypto.subtle.importKey(
      'raw',
      bytes,
      { name: 'AES-KW', length: KEY_BITS },
      false,
      ['wrapKey', 'unwrapKey'],
    );
  }

  // ── Key Wrapping ──

  async wrapKey(masterKey: CryptoKey, wrappingKey: CryptoKey): Promise<string> {
    const wrapped = await crypto.subtle.wrapKey('raw', masterKey, wrappingKey, 'AES-KW');
    return bufferToBase64(wrapped);
  }

  async unwrapKey(wrappedBase64: string, wrappingKey: CryptoKey): Promise<CryptoKey> {
    const wrapped = base64ToBuffer(wrappedBase64);
    return crypto.subtle.unwrapKey(
      'raw',
      wrapped,
      wrappingKey,
      'AES-KW',
      { name: 'AES-GCM', length: KEY_BITS },
      true,
      ['encrypt', 'decrypt'],
    );
  }

  // ── Encrypt / Decrypt (text) ──

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

  // ── Encrypt / Decrypt (binary — for files) ──

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

  // ── Unlock / Lock / Session ──

  async unlock(password: string, saltHex: string, wrappedKeyBase64: string): Promise<void> {
    const salt = hexToBytes(saltHex);
    const wrappingKey = await this.deriveWrappingKey(password, salt);
    const masterKey = await this.unwrapKey(wrappedKeyBase64, wrappingKey);
    this._masterKey.set(masterKey);
    await this.saveToSession(masterKey);
  }

  async unlockWithRecovery(recoveryHex: string, wrappedKeyBase64: string): Promise<void> {
    const wrappingKey = await this.deriveWrappingKeyFromRecovery(recoveryHex);
    const masterKey = await this.unwrapKey(wrappedKeyBase64, wrappingKey);
    this._masterKey.set(masterKey);
    await this.saveToSession(masterKey);
  }

  lock(): void {
    this._masterKey.set(null);
    sessionStorage.removeItem(SESSION_KEY);
  }

  async restoreFromSession(): Promise<boolean> {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return false;

    try {
      const raw = base64ToBuffer(stored);
      const key = await crypto.subtle.importKey(
        'raw',
        raw,
        { name: 'AES-GCM', length: KEY_BITS },
        true,
        ['encrypt', 'decrypt'],
      );
      this._masterKey.set(key);
      return true;
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
      return false;
    }
  }

  getMasterKey(): CryptoKey | null {
    return this._masterKey();
  }

  // ── Private Helpers ──

  private async saveToSession(key: CryptoKey): Promise<void> {
    const raw = await crypto.subtle.exportKey('raw', key);
    sessionStorage.setItem(SESSION_KEY, bufferToBase64(raw));
  }
}

// ── Standalone Helpers (also usable from entity-crypto / file-crypto) ──

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

export async function encryptBufferWithKey(data: ArrayBuffer, key: CryptoKey): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);

  const combined = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), IV_BYTES);

  return combined.buffer;
}

export async function decryptBufferWithKey(data: ArrayBuffer, key: CryptoKey): Promise<ArrayBuffer> {
  const combined = new Uint8Array(data);
  const iv = combined.slice(0, IV_BYTES);
  const ciphertext = combined.slice(IV_BYTES);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
}

// ── Encoding Helpers ──

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

export function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
}
