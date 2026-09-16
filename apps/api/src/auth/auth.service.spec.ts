import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import argon2 from 'argon2';
import * as OTPAuth from 'otpauth';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import { SecretCipherService } from './secret-cipher.service';
import type { ConfigService } from '@nestjs/config';
import type { StorageService } from '../storage/storage.service';
import type { Result } from './auth.result';
import type { AuthRepository } from './auth.repository';
import type { Mailer } from '../mail/mailer';

const repo = () => ({
  findByEmail: vi.fn(),
  bumpSessionVersion: vi.fn((id: string) =>
    Promise.resolve({ id, sessionVersion: 1 }),
  ),
  findById: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  insertCode: vi.fn(),
  findValidCode: vi.fn(),
  deleteCodes: vi.fn(),
  replaceBackupCodes: vi.fn(() => Promise.resolve()),
  consumeBackupCode: vi.fn(() => Promise.resolve(false)),
  countUnusedBackupCodes: vi.fn(() => Promise.resolve(0)),
  deleteBackupCodes: vi.fn(() => Promise.resolve()),
});
const cipher = () =>
  new SecretCipherService({
    get: (k: string) => ({ TOTP_ENC_KEY: 'c'.repeat(64) })[k],
  } as unknown as ConfigService);
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
    svc = new AuthService(
      r as unknown as AuthRepository,
      m as unknown as Mailer,
      new TwoFactorService(),
      {} as StorageService,
      cipher(),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  // register

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

  it('register : email existant NON vérifié → le nouvel inscrit RÉ-APPROPRIE le compte (nouveau hash, 2FA effacée), code envoyé, PAS de createUser', async () => {
    r.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      password: await argon2.hash('mot-de-passe-attaquant'),
      totpSecret: 'SECRET-ATTAQUANT',
      emailVerified: null,
    });
    r.updateUser.mockImplementation((_id, patch) =>
      Promise.resolve({ id: 'u1', email: 'a@b.com', ...patch }),
    );
    const res = await svc.register({
      email: 'a@b.com',
      password: 'motdepasse-victime',
      displayName: 'Victime',
    });
    expect(res.success).toBe(true);
    expect(m.sendVerificationCode).toHaveBeenCalled();
    expect(r.createUser).not.toHaveBeenCalled();
    expect(m.sendAccountExists).not.toHaveBeenCalled();
    // Pre-account-takeover : le mot de passe du premier « inscrit » ne doit plus être valide.
    const patch = r.updateUser.mock.calls[0][1] as {
      password: string;
      totpSecret: unknown;
      totpEnabled: unknown;
      displayName: string;
    };
    expect(await argon2.verify(patch.password, 'motdepasse-victime')).toBe(
      true,
    );
    expect(await argon2.verify(patch.password, 'mot-de-passe-attaquant')).toBe(
      false,
    );
    expect(patch.totpSecret).toBeNull();
    expect(patch.totpEnabled).toBeNull();
    expect(patch.displayName).toBe('Victime');
  });

  it('register : email existant DÉJÀ vérifié → aucune écriture sur le compte (updateUser jamais appelé)', async () => {
    r.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      emailVerified: new Date(),
    });
    await svc.register({ email: 'a@b.com', password: 'motdepasse-long' });
    expect(r.updateUser).not.toHaveBeenCalled();
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

  // login

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

  // genCode

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

  // régressions inchangées

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
    svc = new AuthService(
      r as unknown as AuthRepository,
      m as unknown as Mailer,
      tf,
      {} as StorageService,
      cipher(),
    );
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
    svc = new AuthService(
      r as unknown as AuthRepository,
      m as unknown as Mailer,
      tf,
      {} as StorageService,
      cipher(),
    );
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

// Le storage (4e dépendance) est injecté en plus du repo + mailer + twoFactor.
describe('AuthService.deleteAccount (RGPD)', () => {
  const repoFor = () => ({
    replaceBackupCodes: vi.fn(() => Promise.resolve()),
    consumeBackupCode: vi.fn(() => Promise.resolve(false)),
    countUnusedBackupCodes: vi.fn(() => Promise.resolve(0)),
    deleteBackupCodes: vi.fn(() => Promise.resolve()),
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
      cipher(),
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

describe('AuthService — révocation de session et anti-rejeu TOTP', () => {
  const repoWithBump = () => ({
    replaceBackupCodes: vi.fn(() => Promise.resolve()),
    consumeBackupCode: vi.fn(() => Promise.resolve(false)),
    countUnusedBackupCodes: vi.fn(() => Promise.resolve(0)),
    deleteBackupCodes: vi.fn(() => Promise.resolve()),
    ...repo(),
    bumpSessionVersion: vi.fn((id: string) =>
      Promise.resolve({ id, sessionVersion: 1 }),
    ),
  });
  let r: ReturnType<typeof repoWithBump>;
  let m: ReturnType<typeof mailer>;
  let svc: AuthService;
  const tf = new TwoFactorService();

  beforeEach(() => {
    r = repoWithBump();
    m = mailer();
    svc = new AuthService(
      r as unknown as AuthRepository,
      m as unknown as Mailer,
      tf,
      { deletePrefix: vi.fn() } as unknown as StorageService,
      cipher(),
    );
  });

  it('changePassword : incrémente session_version et renvoie l’utilisateur pour ré-émettre le cookie', async () => {
    r.findById.mockResolvedValue({
      id: 'u1',
      password: await argon2.hash('ancien-mdp-long-1'),
      encryptionVersion: 0,
    });
    r.updateUser.mockResolvedValue({ id: 'u1' });
    const res = await svc.changePassword('u1', {
      currentPassword: 'ancien-mdp-long-1',
      newPassword: 'nouveau-mdp-long-1',
    });
    expect(res).toMatchObject({ success: true, data: { sessionVersion: 1 } });
    expect(r.bumpSessionVersion).toHaveBeenCalledWith('u1');
  });

  it('resetPassword : incrémente session_version (déconnecte un voleur de cookie)', async () => {
    r.findValidCode.mockResolvedValue({ id: 'c1' });
    r.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      encryptionVersion: 0,
    });
    r.updateUser.mockResolvedValue({ id: 'u1' });
    await svc.resetPassword({
      email: 'a@b.com',
      code: '123456',
      newPassword: 'nouveau-long-123',
    });
    expect(r.bumpSessionVersion).toHaveBeenCalledWith('u1');
  });

  it('revokeSessions (logout) : incrémente session_version', async () => {
    await svc.revokeSessions('u1');
    expect(r.bumpSessionVersion).toHaveBeenCalledWith('u1');
  });

  it('setupTotp : 2FA déjà active → 409, aucun nouveau secret écrit', async () => {
    r.findById.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      totpEnabled: new Date(),
    });
    const res = await svc.setupTotp('u1');
    expect(res).toMatchObject({ success: false, status: 409 });
    expect(r.updateUser).not.toHaveBeenCalled();
  });

  it('login 2FA : un code déjà consommé (même pas TOTP) est refusé au second essai', async () => {
    const { secret } = tf.generateSecret('a@b.com');
    const totp = new OTPAuth.TOTP({
      issuer: 'DashFlow',
      label: 'a@b.com',
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const code = totp.generate();
    const user = {
      id: 'u1',
      email: 'a@b.com',
      password: await argon2.hash('bonmotdepasse'),
      emailVerified: new Date(),
      totpEnabled: new Date(),
      totpSecret: secret,
      totpLastUsedStep: null as number | null,
    };
    r.findByEmail.mockResolvedValue(user);
    r.updateUser.mockImplementation((_id, patch) => {
      Object.assign(user, patch);
      return Promise.resolve(user);
    });

    const first = await svc.login({
      email: 'a@b.com',
      password: 'bonmotdepasse',
      totpCode: code,
    });
    expect(first).toMatchObject({
      success: true,
      data: { kind: 'authenticated' },
    });
    expect(typeof user.totpLastUsedStep).toBe('number');

    const replay = await svc.login({
      email: 'a@b.com',
      password: 'bonmotdepasse',
      totpCode: code,
    });
    expect(replay).toMatchObject({ success: false, status: 401 });
  });

  // 2FA au repos + codes de secours

  it('setupTotp : le secret est stocké chiffré (v1.…), pas le base32 renvoyé au client', async () => {
    r.findById.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      totpEnabled: null,
    });
    r.updateUser.mockResolvedValue({});
    const res = await svc.setupTotp('u1');
    expect(res.success).toBe(true);
    const stored = r.updateUser.mock.calls[0][1].totpSecret as string;
    expect(stored.startsWith('v1.')).toBe(true);
    if (res.success) {
      expect(stored).not.toContain(res.data.secret);
      expect(cipher().decrypt(stored)).toBe(res.data.secret);
    }
  });

  it('enableTotp : accepte le code, active, et émet 10 codes de secours stockés en HMAC', async () => {
    const secret = new OTPAuth.Secret({ size: 20 }).base32;
    r.findById.mockResolvedValue({
      id: 'u1',
      totpSecret: cipher().encrypt(secret),
      totpEnabled: null,
      totpLastUsedStep: null,
    });
    r.updateUser.mockResolvedValue({});
    const code = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret),
    }).generate();
    const res = await svc.enableTotp('u1', code);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.backupCodes).toHaveLength(10);
    const hashes = r.replaceBackupCodes.mock.calls[0][1] as string[];
    expect(hashes).toHaveLength(10);
    for (const c of res.data.backupCodes)
      expect(hashes).toContain(cipher().hmac(c));
    expect(hashes).not.toContain(res.data.backupCodes[0]);
  });

  it('login : un secret historique en clair est accepté puis ré-écrit chiffré', async () => {
    const secret = new OTPAuth.Secret({ size: 20 }).base32;
    const hash = await argon2.hash('motdepasse-long-12');
    r.findByEmail.mockResolvedValue({
      id: 'u1',
      password: hash,
      emailVerified: new Date(),
      totpEnabled: new Date(),
      totpSecret: secret, // clair (avant chiffrement au repos)
      totpLastUsedStep: null,
    });
    r.updateUser.mockResolvedValue({});
    const code = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret),
    }).generate();
    const res = await svc.login({
      email: 'a@b.com',
      password: 'motdepasse-long-12',
      totpCode: code,
    });
    expect(res.success).toBe(true);
    const rewrite = r.updateUser.mock.calls.find(
      (c) => 'totpSecret' in (c[1] as object),
    );
    expect(rewrite).toBeDefined();
    expect(
      (rewrite![1] as { totpSecret: string }).totpSecret.startsWith('v1.'),
    ).toBe(true);
  });

  it('login : un code de secours valide est consommé (HMAC) et renvoie le restant ; invalide → 401', async () => {
    const hash = await argon2.hash('motdepasse-long-12');
    r.findByEmail.mockResolvedValue({
      id: 'u1',
      password: hash,
      emailVerified: new Date(),
      totpEnabled: new Date(),
      totpSecret: cipher().encrypt('JBSWY3DPEHPK3PXP'),
      totpLastUsedStep: null,
    });
    r.consumeBackupCode.mockResolvedValueOnce(true);
    r.countUnusedBackupCodes.mockResolvedValueOnce(9);
    const res = await svc.login({
      email: 'a@b.com',
      password: 'motdepasse-long-12',
      totpCode: 'ABCDE FGHJK',
    });
    expect(res.success).toBe(true);
    if (res.success && res.data.kind === 'authenticated') {
      expect(res.data.backupCodesRemaining).toBe(9);
    }
    expect(r.consumeBackupCode).toHaveBeenCalledWith(
      'u1',
      cipher().hmac('abcde-fghjk'),
    );

    r.consumeBackupCode.mockResolvedValueOnce(false);
    const bad = await svc.login({
      email: 'a@b.com',
      password: 'motdepasse-long-12',
      totpCode: 'abcde-fghjk',
    });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.status).toBe(401);
  });

  it('regenerateBackupCodes : mot de passe requis, 2FA active requise', async () => {
    const hash = await argon2.hash('motdepasse-long-12');
    r.findById.mockResolvedValue({
      id: 'u1',
      password: hash,
      totpEnabled: new Date(),
    });
    const wrong = await svc.regenerateBackupCodes('u1', 'nope');
    expect(wrong.success).toBe(false);
    if (!wrong.success) expect(wrong.status).toBe(401);
    const res = await svc.regenerateBackupCodes('u1', 'motdepasse-long-12');
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.backupCodes).toHaveLength(10);
    r.findById.mockResolvedValue({
      id: 'u1',
      password: hash,
      totpEnabled: null,
    });
    const off = await svc.regenerateBackupCodes('u1', 'motdepasse-long-12');
    expect(off.success).toBe(false);
    if (!off.success) expect(off.status).toBe(409);
  });

  it('disableTotp : purge les codes de secours', async () => {
    const hash = await argon2.hash('motdepasse-long-12');
    r.findById.mockResolvedValue({
      id: 'u1',
      password: hash,
      totpEnabled: new Date(),
    });
    r.updateUser.mockResolvedValue({});
    const res = await svc.disableTotp('u1', 'motdepasse-long-12');
    expect(res.success).toBe(true);
    expect(r.deleteBackupCodes).toHaveBeenCalledWith('u1');
  });
});
