import { describe, it, expect, beforeAll } from 'vitest';
import {
  bufferToBase64,
  base64ToBuffer,
  bytesToHex,
  hexToBytes,
  encryptWithKey,
  decryptWithKey,
  encryptBufferWithKey,
  decryptBufferWithKey,
} from './crypto.store';

describe('encoding helpers', () => {
  it('bufferToBase64 / base64ToBuffer roundtrip', () => {
    const original = new Uint8Array([0, 1, 127, 128, 255]);
    const base64 = bufferToBase64(original.buffer);
    const restored = new Uint8Array(base64ToBuffer(base64));

    expect(restored).toEqual(original);
  });

  it('bytesToHex / hexToBytes roundtrip', () => {
    const original = new Uint8Array([0, 15, 16, 255]);
    const hex = bytesToHex(original);
    const restored = hexToBytes(hex);

    expect(hex).toBe('000f10ff');
    expect(restored).toEqual(original);
  });

  it('bytesToHex pads single-digit bytes', () => {
    const hex = bytesToHex(new Uint8Array([0, 1, 2]));
    expect(hex).toBe('000102');
  });
});

describe('text encrypt/decrypt', () => {
  let key: CryptoKey;

  beforeAll(async () => {
    key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
  });

  it('should roundtrip plaintext', async () => {
    const plaintext = 'Bonjour, monde! 🌍';
    const encrypted = await encryptWithKey(plaintext, key);
    const decrypted = await decryptWithKey(encrypted, key);

    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext each time (random IV)', async () => {
    const plaintext = 'same input';
    const a = await encryptWithKey(plaintext, key);
    const b = await encryptWithKey(plaintext, key);

    expect(a).not.toBe(b);
  });

  it('should handle empty string', async () => {
    const encrypted = await encryptWithKey('', key);
    const decrypted = await decryptWithKey(encrypted, key);

    expect(decrypted).toBe('');
  });
});

describe('buffer encrypt/decrypt', () => {
  let key: CryptoKey;

  beforeAll(async () => {
    key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
  });

  it('should roundtrip binary data', async () => {
    const original = new Uint8Array([0, 1, 2, 127, 128, 255]);
    const encrypted = await encryptBufferWithKey(original.buffer, key);
    const decrypted = new Uint8Array(await decryptBufferWithKey(encrypted, key));

    expect(decrypted).toEqual(original);
  });
});
