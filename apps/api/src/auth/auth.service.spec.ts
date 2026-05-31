import { describe, it, expect, vi, beforeEach } from 'vitest';
import argon2 from 'argon2';
import { AuthService } from './auth.service';

const repo = () => ({
  findByEmail: vi.fn(), findById: vi.fn(), createUser: vi.fn(), updateUser: vi.fn(),
  insertCode: vi.fn(), findValidCode: vi.fn(), deleteCodes: vi.fn(),
});
const mailer = () => ({ sendVerificationCode: vi.fn(), sendPasswordResetCode: vi.fn() });

describe('AuthService', () => {
  let r: ReturnType<typeof repo>; let m: ReturnType<typeof mailer>; let svc: AuthService;
  beforeEach(() => { r = repo(); m = mailer(); svc = new AuthService(r as any, m as any); });

  it('register : hash le mdp, crée le user, envoie un code', async () => {
    r.findByEmail.mockResolvedValue(undefined);
    r.createUser.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    const res = await svc.register({ email: 'a@b.com', password: 'motdepasse-long' });
    expect(res.success).toBe(true);
    const created = r.createUser.mock.calls[0][0];
    expect(created.password).not.toBe('motdepasse-long');
    expect(await argon2.verify(created.password, 'motdepasse-long')).toBe(true);
    expect(m.sendVerificationCode).toHaveBeenCalled();
  });

  it('register : email déjà pris → fail 409', async () => {
    r.findByEmail.mockResolvedValue({ id: 'u1' });
    const res = await svc.register({ email: 'a@b.com', password: 'motdepasse-long' });
    expect(res).toMatchObject({ success: false, status: 409 });
  });

  it('login : mauvais mot de passe → fail 401', async () => {
    r.findByEmail.mockResolvedValue({ id: 'u1', email: 'a@b.com', password: await argon2.hash('bonmotdepasse'), emailVerified: new Date() });
    const res = await svc.login({ email: 'a@b.com', password: 'mauvais' });
    expect(res).toMatchObject({ success: false, status: 401 });
  });

  it('login : email non vérifié → fail 403', async () => {
    r.findByEmail.mockResolvedValue({ id: 'u1', email: 'a@b.com', password: await argon2.hash('bonmotdepasse'), emailVerified: null });
    const res = await svc.login({ email: 'a@b.com', password: 'bonmotdepasse' });
    expect(res).toMatchObject({ success: false, status: 403 });
  });

  it('changePassword : compte chiffré sans re-wrap → fail 400', async () => {
    r.findById.mockResolvedValue({ id: 'u1', password: await argon2.hash('actuel-long-1'), encryptionVersion: 1 });
    const res = await svc.changePassword('u1', { currentPassword: 'actuel-long-1', newPassword: 'nouveau-long-12' });
    expect(res).toMatchObject({ success: false, status: 400 });
  });

  it('forgotPassword : toujours success (générique) même si compte inconnu', async () => {
    r.findByEmail.mockResolvedValue(undefined);
    const res = await svc.forgotPassword('inconnu@b.com');
    expect(res.success).toBe(true);
    expect(m.sendPasswordResetCode).not.toHaveBeenCalled();
  });
});
