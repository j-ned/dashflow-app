import { encryptBufferWithKey, decryptBufferWithKey } from './crypto.store';

// Format du contenu chiffré d'un fichier (avant AES-GCM) :
//   "DFE1" (4 octets) · longueur du MIME (1 octet) · MIME d'origine (UTF-8) · octets du fichier
// Le MIME d'origine voyage DANS le chiffré : le serveur ne voit qu'un `application/octet-stream`
// et ne stocke aucune métadonnée en clair sur la nature du document (ordonnance, fiche de paie...).
const FORMAT_MAGIC = new Uint8Array([0x44, 0x46, 0x45, 0x31]); // "DFE1"
const MIME_MAX_BYTES = 255;

export async function encryptFile(file: File, key: CryptoKey): Promise<Blob> {
  const data = new Uint8Array(await file.arrayBuffer());
  const mime = new TextEncoder().encode(file.type).slice(0, MIME_MAX_BYTES);

  const plaintext = new Uint8Array(FORMAT_MAGIC.length + 1 + mime.length + data.length);
  plaintext.set(FORMAT_MAGIC, 0);
  plaintext[FORMAT_MAGIC.length] = mime.length;
  plaintext.set(mime, FORMAT_MAGIC.length + 1);
  plaintext.set(data, FORMAT_MAGIC.length + 1 + mime.length);

  const encrypted = await encryptBufferWithKey(plaintext.buffer, key);
  return new Blob([encrypted], { type: 'application/octet-stream' });
}

/**
 * Déchiffre un fichier et restitue son MIME d'origine (embarqué dans le chiffré).
 * `fallbackMimeType` ne sert qu'aux blobs antérieurs au format "DFE1" (sans en-tête).
 */
export async function decryptFile(
  encryptedBlob: Blob,
  key: CryptoKey,
  fallbackMimeType: string,
): Promise<Blob> {
  const data = await encryptedBlob.arrayBuffer();
  const decrypted = new Uint8Array(await decryptBufferWithKey(data, key));

  if (!hasFormatHeader(decrypted)) {
    return new Blob([decrypted], { type: fallbackMimeType });
  }

  const mimeLength = decrypted[FORMAT_MAGIC.length];
  const mimeStart = FORMAT_MAGIC.length + 1;
  const mime = new TextDecoder().decode(decrypted.slice(mimeStart, mimeStart + mimeLength));
  const content = decrypted.slice(mimeStart + mimeLength);
  return new Blob([content], { type: mime || fallbackMimeType });
}

function hasFormatHeader(bytes: Uint8Array): boolean {
  if (bytes.length < FORMAT_MAGIC.length + 1) return false;
  return FORMAT_MAGIC.every((b, i) => bytes[i] === b);
}
