import { describe, it, expect } from 'vitest';
import * as OTPAuth from 'otpauth';
import { TwoFactorService } from './two-factor.service';

describe('TwoFactorService', () => {
  const svc = new TwoFactorService();

  it('génère un secret base32 + URI otpauth', () => {
    const { secret, otpauthUri } = svc.generateSecret('a@b.com');
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(otpauthUri).toContain('otpauth://totp/');
  });

  it('verify accepte un code calculé depuis le secret, rejette un faux', () => {
    const { secret } = svc.generateSecret('a@b.com');
    const totp = new OTPAuth.TOTP({
      issuer: 'DashFlow',
      label: 'a@b.com',
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    expect(svc.verify(secret, totp.generate())).toBe(true);
    expect(svc.verify(secret, '000000')).toBe(false);
  });
});
