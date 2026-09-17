import { describe, it, expect, vi, beforeEach } from 'vitest';
import argon2 from 'argon2';
import { EncryptionService } from './encryption.service';
import type { AuthRepository } from './auth.repository';
import type { DrizzleDB } from '../db/drizzle.constants';

const repo = () => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
  updateUser: vi.fn(),
  findValidCode: vi.fn(),
  bumpSessionVersion: vi.fn((id: string) =>
    Promise.resolve({ id, sessionVersion: 1 }),
  ),
  deleteCodes: vi.fn(),
});

describe('EncryptionService (ops user)', () => {
  let r: ReturnType<typeof repo>;
  let svc: EncryptionService;
  beforeEach(() => {
    r = repo();
    svc = new EncryptionService(
      r as unknown as AuthRepository,
      {} as unknown as DrizzleDB,
    );
  });

  const keys = { salt: 's', wrappedMasterKey: 'w', recoveryWrappedKey: 'r' };

  it('setKeys : première pose sans réauthentification → 3 clés + version=1', async () => {
    r.findById.mockResolvedValue({ id: 'u1', encryptionVersion: 0 });
    const res = await svc.setKeys('u1', keys);
    expect(res.success).toBe(true);
    expect(r.updateUser).toHaveBeenCalledWith('u1', {
      encryptionSalt: 's',
      wrappedMasterKey: 'w',
      recoveryWrappedKey: 'r',
      encryptionVersion: 1,
    });
  });

  it.each([
    ['absent', undefined],
    ['faux', 'mauvais-mot-de-passe'],
  ])(
    'setKeys : remplacement de clés avec mot de passe %s → 403, rien écrit',
    async (_label, currentPassword) => {
      r.findById.mockResolvedValue({
        id: 'u1',
        encryptionVersion: 1,
        password: await argon2.hash('le-bon-mot-de-passe'),
      });
      const res = await svc.setKeys('u1', { ...keys, currentPassword });
      expect(res).toMatchObject({
        success: false,
        status: 403,
        code: 'REAUTH_REQUIRED',
      });
      expect(r.updateUser).not.toHaveBeenCalled();
    },
  );

  it('setKeys : remplacement de clés avec le bon mot de passe → écrit', async () => {
    r.findById.mockResolvedValue({
      id: 'u1',
      encryptionVersion: 1,
      password: await argon2.hash('le-bon-mot-de-passe'),
    });
    const res = await svc.setKeys('u1', {
      ...keys,
      currentPassword: 'le-bon-mot-de-passe',
    });
    expect(res.success).toBe(true);
    expect(r.updateUser).toHaveBeenCalledOnce();
  });

  it('setPassphrase : pose le flag', async () => {
    r.updateUser.mockResolvedValue({ id: 'u1' });
    await svc.setPassphrase('u1');
    expect(r.updateUser).toHaveBeenCalledWith('u1', {
      encryptionPassphrase: true,
    });
  });

  it('resetPasswordWithRecovery : compte chiffré + clé ré-emballée → mot de passe et clés en une écriture', async () => {
    r.findValidCode.mockResolvedValue({ id: 'c1' });
    r.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      encryptionVersion: 1,
    });
    const res = await svc.resetPasswordWithRecovery({
      email: 'a@b.com',
      code: '123456',
      newPassword: 'nouveau-long-123',
      newSalt: 's',
      newWrappedMasterKey: 'w',
    });
    expect(res.success).toBe(true);
    expect(r.updateUser).toHaveBeenCalledOnce();
    const patch = r.updateUser.mock.calls[0][1];
    expect(patch.encryptionSalt).toBe('s');
    expect(patch.wrappedMasterKey).toBe('w');
    expect(await argon2.verify(patch.password, 'nouveau-long-123')).toBe(true);
    expect(r.bumpSessionVersion).toHaveBeenCalledWith('u1');
  });

  it.each([
    ['ni clé ni effacement', {}],
    [
      'clé ET effacement',
      { newSalt: 's', newWrappedMasterKey: 'w', wipe: true as const },
    ],
  ])(
    'resetPasswordWithRecovery : compte chiffré, %s → 400, rien écrit',
    async (_label, extra) => {
      r.findValidCode.mockResolvedValue({ id: 'c1' });
      r.findByEmail.mockResolvedValue({ id: 'u1', encryptionVersion: 1 });
      const res = await svc.resetPasswordWithRecovery({
        email: 'a@b.com',
        code: '123456',
        newPassword: 'nouveau-long-123',
        ...extra,
      });
      expect(res).toMatchObject({ success: false, status: 400 });
      expect(r.updateUser).not.toHaveBeenCalled();
      expect(r.deleteCodes).not.toHaveBeenCalled();
    },
  );

  it('resetPasswordWithRecovery : compte en clair → les clés envoyées sont ignorées', async () => {
    r.findValidCode.mockResolvedValue({ id: 'c1' });
    r.findByEmail.mockResolvedValue({ id: 'u1', encryptionVersion: 0 });
    await svc.resetPasswordWithRecovery({
      email: 'a@b.com',
      code: '123456',
      newPassword: 'nouveau-long-123',
      newSalt: 's',
      newWrappedMasterKey: 'w',
    });
    expect(Object.keys(r.updateUser.mock.calls[0][1])).toEqual(['password']);
  });

  it('resetPasswordWithRecovery : code invalide → fail', async () => {
    r.findValidCode.mockResolvedValue(undefined);
    expect(
      (
        await svc.resetPasswordWithRecovery({
          email: 'a@b.com',
          code: 'x',
          newPassword: 'nouveau-long-123',
        })
      ).success,
    ).toBe(false);
  });
});
