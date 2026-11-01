import { describe, it, expect, beforeAll } from 'vitest';
import { encryptFile, decryptFile } from './file-crypto';
import { encryptBufferWithKey } from './crypto.store';

// Format "DFE1" : le MIME d'origine voyage dans le chiffré, le serveur ne voit qu'un octet-stream.
describe('file-crypto', () => {
  let key: CryptoKey;

  beforeAll(async () => {
    key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]);
  });

  it('given un PDF, when encryptFile, then le blob envoyé est un octet-stream sans magic-bytes PDF', async () => {
    const file = new File([new TextEncoder().encode('%PDF-1.4 hello')], 'a.pdf', {
      type: 'application/pdf',
    });

    const encrypted = await encryptFile(file, key);
    const bytes = new Uint8Array(await encrypted.arrayBuffer());

    expect(encrypted.type).toBe('application/octet-stream');
    expect(new TextDecoder().decode(bytes)).not.toContain('%PDF');
  });

  it('given un fichier chiffré, when decryptFile, then contenu ET MIME d’origine restitués (fallback ignoré)', async () => {
    const content = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const file = new File([content], 'scan.png', { type: 'image/png' });

    const encrypted = await encryptFile(file, key);
    const decrypted = await decryptFile(encrypted, key, 'application/pdf');

    expect(decrypted.type).toBe('image/png');
    expect(new Uint8Array(await decrypted.arrayBuffer())).toEqual(content);
  });

  it('given un fichier sans type, when roundtrip, then le MIME de secours est utilisé', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'x', { type: '' });

    const decrypted = await decryptFile(await encryptFile(file, key), key, 'application/pdf');

    expect(decrypted.type).toBe('application/pdf');
    expect(decrypted.size).toBe(3);
  });

  it('given un blob chiffré sans en-tête (ancien format), when decryptFile, then contenu brut + MIME de secours', async () => {
    const raw = new Uint8Array([9, 8, 7, 6, 5]);
    const legacy = new Blob([await encryptBufferWithKey(raw.buffer, key)]);

    const decrypted = await decryptFile(legacy, key, 'image/jpeg');

    expect(decrypted.type).toBe('image/jpeg');
    expect(new Uint8Array(await decrypted.arrayBuffer())).toEqual(raw);
  });

  it('given une mauvaise clé, when decryptFile, then rejette (AES-GCM authentifié)', async () => {
    const other = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]);
    const encrypted = await encryptFile(new File([new Uint8Array([1])], 'a.pdf'), key);

    await expect(decryptFile(encrypted, other, 'application/pdf')).rejects.toBeDefined();
  });
});
