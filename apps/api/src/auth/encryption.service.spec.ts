import { describe, it, expect, vi, beforeEach } from 'vitest';
import argon2 from 'argon2';
import { EncryptionService } from './encryption.service';

const repo = () => ({ findByEmail: vi.fn(), findById: vi.fn(), updateUser: vi.fn(), findValidCode: vi.fn(), deleteCodes: vi.fn() });

describe('EncryptionService (ops user)', () => {
  let r: ReturnType<typeof repo>; let svc: EncryptionService;
  beforeEach(() => { r = repo(); svc = new EncryptionService(r as any, {} as any); });

  it('setKeys : update les 3 clés + version=1', async () => {
    r.updateUser.mockResolvedValue({ id: 'u1' });
    const res = await svc.setKeys('u1', { salt: 's', wrappedMasterKey: 'w', recoveryWrappedKey: 'r' });
    expect(res.success).toBe(true);
    expect(r.updateUser).toHaveBeenCalledWith('u1', { encryptionSalt: 's', wrappedMasterKey: 'w', recoveryWrappedKey: 'r', encryptionVersion: 1 });
  });

  it('setPassphrase : pose le flag', async () => {
    r.updateUser.mockResolvedValue({ id: 'u1' });
    await svc.setPassphrase('u1');
    expect(r.updateUser).toHaveBeenCalledWith('u1', { encryptionPassphrase: true });
  });

  it('resetPasswordWithRecovery : code valide → re-hash + maj clés si fournies', async () => {
    r.findValidCode.mockResolvedValue({ id: 'c1' });
    r.findByEmail.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    r.updateUser.mockResolvedValue({ id: 'u1' });
    const res = await svc.resetPasswordWithRecovery({ email: 'a@b.com', code: '123456', newPassword: 'nouveau-long-123', newSalt: 's', newWrappedMasterKey: 'w' });
    expect(res.success).toBe(true);
    const patch = r.updateUser.mock.calls[0][1];
    expect(patch.encryptionSalt).toBe('s');
    expect(await argon2.verify(patch.password, 'nouveau-long-123')).toBe(true);
  });

  it('resetPasswordWithRecovery : code invalide → fail', async () => {
    r.findValidCode.mockResolvedValue(undefined);
    expect((await svc.resetPasswordWithRecovery({ email: 'a@b.com', code: 'x', newPassword: 'nouveau-long-123' })).success).toBe(false);
  });
});
