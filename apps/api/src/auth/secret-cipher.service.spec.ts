import { describe, it, expect } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { SecretCipherService } from './secret-cipher.service';

const HEX_KEY = 'a'.repeat(64);
const config = (env: Record<string, string | undefined>) =>
  ({ get: (k: string) => env[k] }) as unknown as ConfigService;

describe('SecretCipherService', () => {
  const svc = new SecretCipherService(config({ TOTP_ENC_KEY: HEX_KEY }));

  it('aller-retour, IV aléatoire (deux chiffrés différents pour le même clair)', () => {
    const a = svc.encrypt('JBSWY3DPEHPK3PXP');
    const b = svc.encrypt('JBSWY3DPEHPK3PXP');
    expect(a).not.toBe(b);
    expect(a.startsWith('v1.')).toBe(true);
    expect(svc.decrypt(a)).toBe('JBSWY3DPEHPK3PXP');
    expect(svc.decrypt(b)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('un secret historique en clair (base32) est rendu tel quel', () => {
    expect(svc.isEncrypted('JBSWY3DPEHPK3PXP')).toBe(false);
    expect(svc.decrypt('JBSWY3DPEHPK3PXP')).toBe('JBSWY3DPEHPK3PXP');
  });

  it('chiffré altéré ou déchiffré avec une autre clé → lève (GCM authentifie)', () => {
    const enc = svc.encrypt('SECRET');
    const parts = enc.split('.');
    parts[2] = parts[2].replace(/^./, (c) => (c === 'A' ? 'B' : 'A'));
    expect(() => svc.decrypt(parts.join('.'))).toThrow();
    const other = new SecretCipherService(
      config({ TOTP_ENC_KEY: 'b'.repeat(64) }),
    );
    expect(() => other.decrypt(enc)).toThrow();
  });

  it('clé acceptée en hex ou base64, refusée si pas 32 octets', () => {
    expect(SecretCipherService.decodeKey(HEX_KEY)).toHaveLength(32);
    expect(
      SecretCipherService.decodeKey(Buffer.alloc(32, 7).toString('base64')),
    ).toHaveLength(32);
    expect(() => SecretCipherService.decodeKey('court')).toThrow(/32 octets/);
  });

  it('sans TOTP_ENC_KEY : clé dérivée de JWT_SECRET, stable entre instances', () => {
    const env = { JWT_SECRET: 'x'.repeat(40), NODE_ENV: 'test' };
    const a = new SecretCipherService(config(env));
    const b = new SecretCipherService(config(env));
    expect(b.decrypt(a.encrypt('S'))).toBe('S');
    expect(a.hmac('code')).toBe(b.hmac('code'));
  });

  it('hmac : déterministe, 64 hex, dépend de la clé', () => {
    const h = svc.hmac('abcde-fghjk');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(svc.hmac('abcde-fghjk')).toBe(h);
    const other = new SecretCipherService(
      config({ TOTP_ENC_KEY: 'b'.repeat(64) }),
    );
    expect(other.hmac('abcde-fghjk')).not.toBe(h);
  });
});
