import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import type { Env } from '../config/env.schema';

const VERSION = 'v1';
const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;

/**
 * Chiffrement au repos des secrets serveur (secret TOTP) et HMAC des codes de secours.
 *
 * Un dump de la base ne suffit plus à annuler le 2FA de tous les comptes : il faut aussi la
 * clé, qui ne vit que dans l'environnement du backend. Format stocké :
 * `v1.<iv>.<ciphertext>.<tag>` en base64url. Une valeur sans ce préfixe est un secret
 * historique en clair : `decrypt` le rend tel quel et l'appelant le ré-écrit chiffré.
 */
@Injectable()
export class SecretCipherService {
  private readonly logger = new Logger(SecretCipherService.name);
  private readonly key: Buffer;

  constructor(config: ConfigService<Env, true>) {
    const raw = config.get('TOTP_ENC_KEY', { infer: true });
    if (raw) {
      this.key = SecretCipherService.decodeKey(raw);
      return;
    }
    // Repli : clé dérivée du secret JWT (HKDF, contexte dédié). Sûr, mais couple les deux
    // secrets — une rotation de JWT_SECRET rendrait les secrets TOTP illisibles.
    this.key = Buffer.from(
      hkdfSync(
        'sha256',
        config.get('JWT_SECRET', { infer: true }),
        'dashflow-secret-cipher',
        'totp-secret-at-rest',
        KEY_BYTES,
      ),
    );
    if (config.get('NODE_ENV', { infer: true }) === 'production') {
      this.logger.warn(
        'TOTP_ENC_KEY absent : clé dérivée de JWT_SECRET. Définissez TOTP_ENC_KEY (32 octets, hex ou base64) pour découpler les rotations.',
      );
    }
  }

  /** 32 octets en hex (64 car.) ou base64/base64url (43-44 car.). */
  static decodeKey(raw: string): Buffer {
    const trimmed = raw.trim();
    const buf = /^[0-9a-fA-F]{64}$/.test(trimmed)
      ? Buffer.from(trimmed, 'hex')
      : Buffer.from(trimmed, 'base64');
    if (buf.length !== KEY_BYTES) {
      throw new Error(
        `TOTP_ENC_KEY doit faire ${KEY_BYTES} octets (hex ou base64) — reçu ${buf.length}`,
      );
    }
    return buf;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const ct = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      VERSION,
      iv.toString('base64url'),
      ct.toString('base64url'),
      tag.toString('base64url'),
    ].join('.');
  }

  isEncrypted(stored: string): boolean {
    return stored.startsWith(`${VERSION}.`);
  }

  /** Valeur historique en clair → rendue telle quelle. Chiffré altéré → lève. */
  decrypt(stored: string): string {
    if (!this.isEncrypted(stored)) return stored;
    const [, iv, ct, tag] = stored.split('.');
    if (!iv || !ct || !tag) throw new Error('Secret chiffré mal formé');
    const decipher = createDecipheriv(
      ALGO,
      this.key,
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ct, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  /**
   * HMAC-SHA256 (hex) pour stocker les codes de secours : contrairement à un SHA-256 nu, un
   * dump DB ne permet pas de retrouver un code (50 bits) par force brute hors ligne.
   */
  hmac(value: string): string {
    return createHmac('sha256', this.key).update(value, 'utf8').digest('hex');
  }
}
