import { describe, expect, it } from 'vitest';
import * as z from 'zod/mini';
import { AuthUserSchema } from './auth-user.schema';

const VALID = {
  id: 'u1',
  email: 'a@b.c',
  displayName: null,
  avatarUrl: null,
  totpEnabled: false,
  hasPassword: true,
  authVersion: 1,
  googleLinked: false,
  encryptionVersion: 0,
  hasEncryptionPassphrase: false,
  isDemoAccount: false,
  role: 'user',
};

describe('AuthUserSchema', () => {
  it('accepte un utilisateur conforme', () => {
    expect(z.safeParse(AuthUserSchema, VALID).success).toBe(true);
  });

  it('rejette un role inconnu', () => {
    expect(z.safeParse(AuthUserSchema, { ...VALID, role: 'superadmin' }).success).toBe(false);
  });

  it('rejette un encryptionVersion non numérique', () => {
    expect(z.safeParse(AuthUserSchema, { ...VALID, encryptionVersion: '1' }).success).toBe(false);
  });

  it('rejette un champ booléen manquant', () => {
    const { totpEnabled: _totpEnabled, ...withoutTotp } = VALID;
    expect(z.safeParse(AuthUserSchema, withoutTotp).success).toBe(false);
  });
});
