import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import argon2 from 'argon2';
import * as OTPAuth from 'otpauth';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import type { Result } from './auth.result';

const repo = () => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  insertCode: vi.fn(),
  findValidCode: vi.fn(),
  deleteCodes: vi.fn(),
});
// `sendAccountExists` est la NOUVELLE méthode du Mailer (point 1 du spec) : le mock l'expose
// pour que le service puisse l'appeler une fois implémentée (le mock est casté `as any`).
const mailer = () => ({
  sendVerificationCode: vi.fn(),
  sendPasswordResetCode: vi.fn(),
  sendAccountExists: vi.fn(),
});

describe('AuthService', () => {
  let r: ReturnType<typeof repo>;
  let m: ReturnType<typeof mailer>;
  let svc: AuthService;
  beforeEach(() => {
    r = repo();
    m = mailer();
    svc = new AuthService(r as any, m as any, new TwoFactorService());
  });
  afterEach(() => vi.restoreAllMocks());

  // ───────────────────────── register (point 1) ─────────────────────────

  it('register : email inconnu → createUser + sendVerificationCode, retour générique ok', async () => {
    r.findByEmail.mockResolvedValue(undefined);
    r.createUser.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    const res = await svc.register({
      email: 'a@b.com',
      password: 'motdepasse-long',
    });
    expect(res.success).toBe(true);
    const created = r.createUser.mock.calls[0][0];
    expect(created.password).not.toBe('motdepasse-long');
    expect(await argon2.verify(created.password, 'motdepasse-long')).toBe(true);
    expect(m.sendVerificationCode).toHaveBeenCalled();
    expect(m.sendAccountExists).not.toHaveBeenCalled();
  });

  it('register : email existant NON vérifié → sendVerificationCode, PAS de createUser, retour générique ok', async () => {
    r.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      emailVerified: null,
    });
    const res = await svc.register({
      email: 'a@b.com',
      password: 'motdepasse-long',
    });
    expect(res.success).toBe(true);
    expect(m.sendVerificationCode).toHaveBeenCalled();
    expect(r.createUser).not.toHaveBeenCalled();
    expect(m.sendAccountExists).not.toHaveBeenCalled();
  });

  it('register : email existant DÉJÀ vérifié → sendAccountExists seul, ni createUser ni sendVerificationCode, retour générique ok', async () => {
    r.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      emailVerified: new Date(),
    });
    const res = await svc.register({
      email: 'a@b.com',
      password: 'motdepasse-long',
    });
    expect(res.success).toBe(true);
    expect(m.sendAccountExists).toHaveBeenCalledWith('a@b.com');
    expect(r.createUser).not.toHaveBeenCalled();
    expect(m.sendVerificationCode).not.toHaveBeenCalled();
  });

  it('register : AUCUN chemin ne renvoie fail 409 (réécrit l’ancien verrou anti-doublon)', async () => {
    r.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      emailVerified: new Date(),
    });
    const res = await svc.register({
      email: 'a@b.com',
      password: 'motdepasse-long',
    });
    expect(res.success).toBe(true);
    expect(res).not.toMatchObject({ success: false, status: 409 });
  });

  // white-box assumé : hash factice anti-timing
  it('register : email existant → argon2.hash est tout de même invoqué (hash factice anti-timing)', async () => {
    const hashSpy = vi.spyOn(argon2, 'hash').mockResolvedValue('fake-hash');
    r.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      emailVerified: new Date(),
    });
    await svc.register({ email: 'a@b.com', password: 'motdepasse-long' });
    expect(hashSpy).toHaveBeenCalled();
  });

  // ───────────────────────── login (point 2) ─────────────────────────

  it('login : email inconnu → fail générique (identifiants invalides), sans code', async () => {
    r.findByEmail.mockResolvedValue(undefined);
    const res = await svc.login({
      email: 'inconnu@b.com',
      password: 'peu-importe',
    });
    expect(res).toMatchObject({ success: false, status: 401 });
    expect((res as { code?: string }).code).toBeUndefined();
  });

  // white-box assumé : argon2.verify (hash factice) doit s'exécuter aussi sur le chemin « email inconnu »
  it('login : email inconnu → argon2.verify est tout de même invoqué (hash factice anti-timing)', async () => {
    const verifySpy = vi.spyOn(argon2, 'verify').mockResolvedValue(false);
    r.findByEmail.mockResolvedValue(null);
    const res = await svc.login({
      email: 'inconnu@b.com',
      password: 'peu-importe',
    });
    expect(verifySpy).toHaveBeenCalled();
    expect(res).toMatchObject({ success: false, status: 401 });
  });

  it('login : email existant VÉRIFIÉ + mauvais mot de passe → fail 401 générique', async () => {
    r.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      password: await argon2.hash('bonmotdepasse'),
      emailVerified: new Date(),
    });
    const res = await svc.login({ email: 'a@b.com', password: 'mauvais' });
    expect(res).toMatchObject({ success: false, status: 401 });
    expect((res as { code?: string }).code).not.toBe('EMAIL_NOT_VERIFIED');
  });

  it('login : email existant NON vérifié + mauvais mot de passe → fail 401 générique, PAS de EMAIL_NOT_VERIFIED', async () => {
    r.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      password: await argon2.hash('bonmotdepasse'),
      emailVerified: null,
    });
    const res = await svc.login({ email: 'a@b.com', password: 'mauvais' });
    expect(res).toMatchObject({ success: false, status: 401 });
    expect((res as { code?: string }).code).not.toBe('EMAIL_NOT_VERIFIED');
  });

  it('login : email existant NON vérifié + BON mot de passe → fail avec code EMAIL_NOT_VERIFIED', async () => {
    r.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      password: await argon2.hash('bonmotdepasse'),
      emailVerified: null,
    });
    const res = await svc.login({
      email: 'a@b.com',
      password: 'bonmotdepasse',
    });
    expect(res).toMatchObject({ success: false });
    expect((res as { code?: string }).code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('login : email existant VÉRIFIÉ + BON mot de passe → succès authenticated', async () => {
    r.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      password: await argon2.hash('bonmotdepasse'),
      emailVerified: new Date(),
    });
    const res = await svc.login({
      email: 'a@b.com',
      password: 'bonmotdepasse',
    });
    expect(res).toMatchObject({
      success: true,
      data: { kind: 'authenticated' },
    });
  });

  // ───────────────────────── genCode (point 3) ─────────────────────────

  it('genCode : le code transmis à insertCode fait 6 chiffres exactement (contrat de format)', async () => {
    r.findByEmail.mockResolvedValue(undefined);
    r.createUser.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    await svc.register({ email: 'a@b.com', password: 'motdepasse-long' });
    const code = r.insertCode.mock.calls[0][1];
    expect(code).toMatch(/^\d{6}$/);
  });

  it('genCode : n’utilise plus Math.random (génération cryptographique attendue)', async () => {
    const randSpy = vi.spyOn(Math, 'random');
    r.findByEmail.mockResolvedValue(undefined);
    r.createUser.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    await svc.register({ email: 'a@b.com', password: 'motdepasse-long' });
    expect(r.insertCode).toHaveBeenCalled();
    expect(randSpy).not.toHaveBeenCalled();
  });

  // ───────────────────────── régressions inchangées ─────────────────────────

  it('changePassword : compte chiffré sans re-wrap → fail 400', async () => {
    r.findById.mockResolvedValue({
      id: 'u1',
      password: await argon2.hash('actuel-long-1'),
      encryptionVersion: 1,
    });
    const res = await svc.changePassword('u1', {
      currentPassword: 'actuel-long-1',
      newPassword: 'nouveau-long-12',
    });
    expect(res).toMatchObject({ success: false, status: 400 });
  });

  it('forgotPassword : toujours success (générique) même si compte inconnu', async () => {
    r.findByEmail.mockResolvedValue(undefined);
    const res = await svc.forgotPassword('inconnu@b.com');
    expect(res.success).toBe(true);
    expect(m.sendPasswordResetCode).not.toHaveBeenCalled();
  });

  it('enableTotp : code valide → totpEnabled set', async () => {
    const tf = new TwoFactorService();
    const { secret } = tf.generateSecret('a@b.com');
    svc = new AuthService(r as any, m as any, tf);
    r.findById.mockResolvedValue({
      id: 'u1',
      totpSecret: secret,
      totpEnabled: null,
    });
    r.updateUser.mockResolvedValue({ id: 'u1' });
    const totp = new OTPAuth.TOTP({
      issuer: 'DashFlow',
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const res = await svc.enableTotp('u1', totp.generate());
    expect(res.success).toBe(true);
    expect(r.updateUser).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ totpEnabled: expect.any(Date) }),
    );
  });

  it('enableTotp : code invalide → fail', async () => {
    const tf = new TwoFactorService();
    const { secret } = tf.generateSecret('a@b.com');
    svc = new AuthService(r as any, m as any, tf);
    r.findById.mockResolvedValue({
      id: 'u1',
      totpSecret: secret,
      totpEnabled: null,
    });
    expect((await svc.enableTotp('u1', '000000')).success).toBe(false);
  });

  it('login : compte 2FA sans code → succès mfa_required (200, pas une erreur)', async () => {
    r.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      password: await argon2.hash('bonmotdepasse'),
      emailVerified: new Date(),
      totpEnabled: new Date(),
      totpSecret: 'AAAA',
    });
    const res = await svc.login({
      email: 'a@b.com',
      password: 'bonmotdepasse',
    });
    expect(res).toMatchObject({
      success: true,
      data: { kind: 'mfa_required' },
    });
  });

  it('disableTotp : mauvais mot de passe → fail 401', async () => {
    r.findById.mockResolvedValue({
      id: 'u1',
      password: await argon2.hash('bon-mdp-long-1'),
      totpSecret: 'X',
      totpEnabled: new Date(),
    });
    expect(await svc.disableTotp('u1', 'mauvais')).toMatchObject({
      success: false,
      status: 401,
    });
  });

  it('resetPassword : compte chiffré (v=1) SANS clés → succès (pas de 400)', async () => {
    r.findValidCode.mockResolvedValue({ id: 'c1' });
    r.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      encryptionVersion: 1,
    });
    r.updateUser.mockResolvedValue({ id: 'u1' });
    const res = await svc.resetPassword({
      email: 'a@b.com',
      code: '123456',
      newPassword: 'nouveau-long-123',
    });
    expect(res.success).toBe(true);
  });
});

// ───────────────────────── deleteAccount — suppression de compte RGPD ─────────────────────────
// RED attendu : AuthService.deleteAccount n'existe pas encore (méthode absente → comportement dû au GREEN).
// Le storage (4e dépendance) est injecté en plus du repo + mailer + twoFactor.
describe('AuthService.deleteAccount (RGPD)', () => {
  const repoFor = () => ({
    findById: vi.fn(),
    deleteUser: vi.fn(),
    findByEmail: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    insertCode: vi.fn(),
    findValidCode: vi.fn(),
    deleteCodes: vi.fn(),
  });
  const storageFor = () => ({ deletePrefix: vi.fn() });

  type Deletable = AuthService & {
    deleteAccount(userId: string): Promise<Result<null>>;
  };
  const build = (
    r: ReturnType<typeof repoFor>,
    s: ReturnType<typeof storageFor>,
  ): Deletable =>
    new AuthService(
      r as unknown as ConstructorParameters<typeof AuthService>[0],
      {
        sendVerificationCode: vi.fn(),
        sendPasswordResetCode: vi.fn(),
        sendAccountExists: vi.fn(),
      } as unknown as ConstructorParameters<typeof AuthService>[1],
      new TwoFactorService(),
      s as unknown as never,
    );

  afterEach(() => vi.restoreAllMocks());

  it('compte démo → fail 403 ; aucune suppression (ni storage ni DB)', async () => {
    const r = repoFor();
    const s = storageFor();
    r.findById.mockResolvedValue({ id: 'u1', isDemoAccount: true });
    const res = await build(r, s).deleteAccount('u1');
    expect(res).toMatchObject({ success: false, status: 403 });
    expect(s.deletePrefix).not.toHaveBeenCalled();
    expect(r.deleteUser).not.toHaveBeenCalled();
  });

  it('compte normal → efface les 4 préfixes fichiers PUIS supprime l’user, retour ok', async () => {
    const r = repoFor();
    const s = storageFor();
    r.findById.mockResolvedValue({ id: 'u1', isDemoAccount: false });
    s.deletePrefix.mockResolvedValue(undefined);
    r.deleteUser.mockResolvedValue(undefined);
    const res = await build(r, s).deleteAccount('u1');
    expect(res.success).toBe(true);
    expect(s.deletePrefix).toHaveBeenCalledWith('avatars/u1');
    expect(s.deletePrefix).toHaveBeenCalledWith('prescriptions/u1/');
    expect(s.deletePrefix).toHaveBeenCalledWith('documents/u1/');
    expect(s.deletePrefix).toHaveBeenCalledWith('payslips/u1/');
    expect(s.deletePrefix).toHaveBeenCalledTimes(4);
    expect(r.deleteUser).toHaveBeenCalledWith('u1');
  });

  it('ordre fichiers→DB : si deletePrefix rejette, deleteUser n’est PAS appelé et l’erreur est propagée', async () => {
    const r = repoFor();
    const s = storageFor();
    r.findById.mockResolvedValue({ id: 'u1', isDemoAccount: false });
    s.deletePrefix.mockRejectedValue(new Error('S3 indisponible'));
    r.deleteUser.mockResolvedValue(undefined);
    await expect(build(r, s).deleteAccount('u1')).rejects.toThrow();
    expect(r.deleteUser).not.toHaveBeenCalled();
  });
});
