import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';

const ISSUER = 'DashFlow';
const PERIOD_SECONDS = 30;

// Codes de secours : 10 caractères sur un alphabet sans ambiguïté (pas de 0/o, 1/l/i), affichés
// `xxxxx-xxxxx`. 31^10 ≈ 2^49,5 : hors de portée en ligne (login throttlé), et stockés en HMAC.
const BACKUP_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const BACKUP_CODES_COUNT = 10;
const BACKUP_CODE_LENGTH = 10;

@Injectable()
export class TwoFactorService {
  generateSecret(email: string): { secret: string; otpauthUri: string } {
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({ issuer: ISSUER, label: email, secret });
    return { secret: secret.base32, otpauthUri: totp.toString() };
  }

  buildQrDataUrl(otpauthUri: string): Promise<string> {
    return QRCode.toDataURL(otpauthUri);
  }

  verify(secretBase32: string, code: string): boolean {
    return this.verifyStep(secretBase32, code) !== null;
  }

  /**
   * Valide le code (fenêtre ±1 pas de 30 s) et renvoie le pas TOTP absolu qui a matché,
   * ou `null`. L'appelant compare ce pas à `users.totp_last_used_step` : un code accepté ne
   * peut plus l'être une seconde fois, même dans la fenêtre de tolérance (anti-rejeu).
   */
  verifyStep(secretBase32: string, code: string): number | null {
    const totp = new OTPAuth.TOTP({
      issuer: ISSUER,
      secret: OTPAuth.Secret.fromBase32(secretBase32),
      period: PERIOD_SECONDS,
    });
    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) return null;
    return Math.floor(Date.now() / 1000 / PERIOD_SECONDS) + delta;
  }

  generateBackupCodes(): string[] {
    return Array.from({ length: BACKUP_CODES_COUNT }, () => {
      let raw = '';
      for (let i = 0; i < BACKUP_CODE_LENGTH; i++)
        raw += BACKUP_ALPHABET[randomInt(BACKUP_ALPHABET.length)];
      return `${raw.slice(0, 5)}-${raw.slice(5)}`;
    });
  }

  /** Forme canonique d'un code saisi (casse, tiret, espaces) ou `null` si ce n'en est pas un. */
  normalizeBackupCode(input: string): string | null {
    const raw = input.toLowerCase().replace(/[\s-]/g, '');
    if (raw.length !== BACKUP_CODE_LENGTH) return null;
    for (const c of raw) if (!BACKUP_ALPHABET.includes(c)) return null;
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  }

  isTotpCode(input: string): boolean {
    return /^\d{6}$/.test(input);
  }
}
