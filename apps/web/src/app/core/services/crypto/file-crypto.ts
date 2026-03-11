import { encryptBufferWithKey, decryptBufferWithKey } from './crypto.store';

/**
 * Encrypts a File into a Blob (IV + ciphertext, binary).
 */
export async function encryptFile(file: File, key: CryptoKey): Promise<Blob> {
  const data = await file.arrayBuffer();
  const encrypted = await encryptBufferWithKey(data, key);
  return new Blob([encrypted], { type: 'application/octet-stream' });
}

/**
 * Decrypts an encrypted Blob back into a usable Blob with the original MIME type.
 */
export async function decryptFile(encryptedBlob: Blob, key: CryptoKey, mimeType: string): Promise<Blob> {
  const data = await encryptedBlob.arrayBuffer();
  const decrypted = await decryptBufferWithKey(data, key);
  return new Blob([decrypted], { type: mimeType });
}
