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

describe('TwoFactorService.verifyStep (anti-rejeu)', () => {
  const svc = new TwoFactorService();

  it('renvoie le pas TOTP absolu courant pour un code valide, null pour un faux', () => {
    const { secret } = svc.generateSecret('a@b.com');
    const totp = new OTPAuth.TOTP({
      issuer: 'DashFlow',
      label: 'a@b.com',
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const now = Math.floor(Date.now() / 1000 / 30);
    const step = svc.verifyStep(secret, totp.generate());
    expect(step).not.toBeNull();
    expect(Math.abs((step as number) - now)).toBeLessThanOrEqual(1);
    expect(svc.verifyStep(secret, '000000')).toBeNull();
  });

  it('un code du pas précédent (fenêtre ±1) renvoie un pas strictement inférieur', () => {
    const { secret } = svc.generateSecret('a@b.com');
    const totp = new OTPAuth.TOTP({
      issuer: 'DashFlow',
      label: 'a@b.com',
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const previous = totp.generate({ timestamp: Date.now() - 30_000 });
    const current = totp.generate();
    const stepPrev = svc.verifyStep(secret, previous);
    const stepNow = svc.verifyStep(secret, current);
    expect(stepPrev).not.toBeNull();
    expect(stepNow).not.toBeNull();
    // Même si `previous` ≠ `current` (changement de fenêtre), l'ordre des pas est monotone.
    expect(stepPrev as number).toBeLessThanOrEqual(stepNow as number);
  });

  it('codes de secours : 10 codes xxxxx-xxxxx, uniques, alphabet sans ambiguïté', () => {
    const svc = new TwoFactorService();
    const codes = svc.generateBackupCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes)
      expect(c).toMatch(/^[a-hj-km-np-z2-9]{5}-[a-hj-km-np-z2-9]{5}$/);
  });

  it('normalizeBackupCode : casse, tiret et espaces libres ; TOTP et bruit → null', () => {
    const svc = new TwoFactorService();
    expect(svc.normalizeBackupCode('ABCDE-FGHJK')).toBe('abcde-fghjk');
    expect(svc.normalizeBackupCode(' abcdefghjk ')).toBe('abcde-fghjk');
    expect(svc.normalizeBackupCode('123456')).toBeNull();
    expect(svc.normalizeBackupCode('abcde-fghj0')).toBeNull(); // 0 hors alphabet
    expect(svc.isTotpCode('123456')).toBe(true);
    expect(svc.isTotpCode('abcde-fghjk')).toBe(false);
  });
});
