import { Injectable } from '@nestjs/common';
import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';

const ISSUER = 'DashFlow';
const PERIOD_SECONDS = 30;

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
}
