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
  /**
   * Clé dérivée de JWT_SECRET, utilisée tant que TOTP_ENC_KEY n'était pas définie. Gardée en
   * lecture seule une fois TOTP_ENC_KEY posée : les secrets et codes de secours écrits avant
   * restent lisibles, et sont ré-écrits avec la clé courante à leur prochain usage.
   */
  private readonly legacyKey: Buffer | null;

  constructor(config: ConfigService<Env, true>) {
    // Clé dérivée du secret JWT (HKDF, contexte dédié). Sûre, mais couple les deux secrets :
    // une rotation de JWT_SECRET rendrait illisibles les secrets qu'elle protège encore.
    const derived = Buffer.from(
      hkdfSync(
        'sha256',
        config.get('JWT_SECRET', { infer: true }),
        'dashflow-secret-cipher',
        'totp-secret-at-rest',
        KEY_BYTES,
      ),
    );
    const raw = config.get('TOTP_ENC_KEY', { infer: true });
    if (raw) {
      this.key = SecretCipherService.decodeKey(raw);
      this.legacyKey = derived;
      return;
    }
    this.key = derived;
    this.legacyKey = null;
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
    return this.open(stored).plaintext;
  }

  /**
   * Comme `decrypt`, en précisant si la valeur doit être ré-écrite avec la clé courante
   * (en clair, ou chiffrée avec l'ancienne clé dérivée de JWT_SECRET).
   */
  open(stored: string): { plaintext: string; stale: boolean } {
    if (!this.isEncrypted(stored)) return { plaintext: stored, stale: true };
    try {
      return { plaintext: this.decryptWith(this.key, stored), stale: false };
    } catch (error) {
      if (!this.legacyKey) throw error;
      return {
        plaintext: this.decryptWith(this.legacyKey, stored),
        stale: true,
      };
    }
  }

  private decryptWith(key: Buffer, stored: string): string {
    const [, iv, ct, tag] = stored.split('.');
    if (!iv || !ct || !tag) throw new Error('Secret chiffré mal formé');
    const decipher = createDecipheriv(ALGO, key, Buffer.from(iv, 'base64url'));
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

  /** HMAC avec l'ancienne clé dérivée : codes de secours émis avant TOTP_ENC_KEY. `null` s'il n'y en a pas. */
  legacyHmac(value: string): string | null {
    if (!this.legacyKey) return null;
    return createHmac('sha256', this.legacyKey)
      .update(value, 'utf8')
      .digest('hex');
  }
}
