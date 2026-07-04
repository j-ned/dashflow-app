import { Injectable } from '@nestjs/common';
import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';

const ISSUER = 'DashFlow';

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
    const totp = new OTPAuth.TOTP({
      issuer: ISSUER,
      secret: OTPAuth.Secret.fromBase32(secretBase32),
    });
    return totp.validate({ token: code, window: 1 }) !== null;
  }
}
