import { describe, it, expect } from 'vitest';
import {
  assessAccountSecurity,
  isEligibleFor,
  type AccountSecurityInput,
} from './account-security';

const secure: AccountSecurityInput = {
  isDemoAccount: false,
  hasPassword: true,
  authVersion: 1,
  encryptionVersion: 1,
  hasRecoveryKey: true,
  totpEnabled: true,
};

describe('assessAccountSecurity', () => {
  it('compte à jour : ok, aucun manque', () => {
    expect(assessAccountSecurity(secure)).toEqual({ status: 'ok', issues: [] });
  });

  it('compte démo : hors périmètre, jamais relancé', () => {
    const s = assessAccountSecurity({
      ...secure,
      isDemoAccount: true,
      authVersion: 0,
      encryptionVersion: 0,
    });
    expect(s).toEqual({ status: 'exempt', issues: [] });
  });

  it('auth_version 0 avec mot de passe : reconnexion requise', () => {
    const s = assessAccountSecurity({ ...secure, authVersion: 0 });
    expect(s.status).toBe('action');
    expect(isEligibleFor(s, 'reconnect')).toBe(true);
  });

  it('compte OAuth sans mot de passe : auth_version 0 ne demande rien', () => {
    const s = assessAccountSecurity({
      ...secure,
      hasPassword: false,
      authVersion: 0,
    });
    expect(isEligibleFor(s, 'reconnect')).toBe(false);
    expect(s.status).toBe('ok');
  });

  it('sans chiffrement : on demande le chiffrement, pas encore la clé de récupération', () => {
    const s = assessAccountSecurity({
      ...secure,
      encryptionVersion: 0,
      hasRecoveryKey: false,
    });
    expect(s.issues.map((i) => i.reason)).toEqual(['enable_encryption']);
  });

  it('chiffré sans clé de récupération : action requise', () => {
    const s = assessAccountSecurity({ ...secure, hasRecoveryKey: false });
    expect(s.status).toBe('action');
    expect(isEligibleFor(s, 'recovery_key')).toBe(true);
  });

  it('2FA absente seule : simple recommandation', () => {
    const s = assessAccountSecurity({ ...secure, totpEnabled: false });
    expect(s).toEqual({
      status: 'recommended',
      issues: [{ reason: 'enable_2fa', severity: 'recommended' }],
    });
  });
});
