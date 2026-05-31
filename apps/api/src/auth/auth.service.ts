import { Inject, Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { AuthRepository } from './auth.repository';
import { MAILER, type Mailer } from '../mail/mailer';
import { ok, fail, type Result } from './auth.result';
import { TwoFactorService } from './two-factor.service';
import type { users } from '../db/schema';
import type { RegisterDto, VerifyDto, LoginDto, ResetPasswordDto, UpdatePasswordDto, SetPasswordDto } from './dto/auth.dto';

type User = typeof users.$inferSelect;
const CODE_TTL_MS = 10 * 60 * 1000;
const genCode = (): string => String(Math.floor(100000 + Math.random() * 900000));

@Injectable()
export class AuthService {
  constructor(
    private readonly repo: AuthRepository,
    @Inject(MAILER) private readonly mailer: Mailer,
    private readonly twoFactor: TwoFactorService,
  ) {}

  async register(dto: RegisterDto): Promise<Result<User>> {
    const existing = await this.repo.findByEmail(dto.email);
    if (existing) return fail(409, 'Un compte existe déjà avec cet email');
    const hash = await argon2.hash(dto.password);
    const user = await this.repo.createUser({ email: dto.email, password: hash, displayName: dto.displayName });
    await this.sendCode(dto.email, 'verification');
    return ok(user);
  }

  async verify(dto: VerifyDto): Promise<Result<User>> {
    const valid = await this.repo.findValidCode(dto.email, dto.code);
    if (!valid) return fail(400, 'Code invalide ou expiré');
    const user = await this.repo.findByEmail(dto.email);
    if (!user) return fail(404, 'Compte introuvable');
    const updated = await this.repo.updateUser(user.id, { emailVerified: new Date() });
    await this.repo.deleteCodes(dto.email);
    return ok(updated);
  }

  async login(dto: LoginDto): Promise<Result<User>> {
    const user = await this.repo.findByEmail(dto.email);
    if (!user || !user.password) return fail(401, 'Identifiants invalides');
    if (!user.emailVerified) return fail(403, 'Email non vérifié');
    if (!(await argon2.verify(user.password, dto.password))) return fail(401, 'Identifiants invalides');
    if (user.totpEnabled && user.totpSecret) {
      if (!dto.totpCode) return fail(403, 'Code 2FA requis', 'TOTP_REQUIRED');
      if (!this.twoFactor.verify(user.totpSecret, dto.totpCode)) return fail(401, 'Code 2FA invalide');
    }
    return ok(user);
  }

  async forgotPassword(email: string): Promise<Result<null>> {
    const user = await this.repo.findByEmail(email);
    if (user && user.emailVerified) await this.sendCode(email, 'reset');
    return ok(null);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<Result<null>> {
    const valid = await this.repo.findValidCode(dto.email, dto.code);
    if (!valid) return fail(400, 'Code invalide ou expiré');
    const user = await this.repo.findByEmail(dto.email);
    if (!user) return fail(404, 'Compte introuvable');
    const rewrap = this.checkRewrap(user.encryptionVersion, dto.newSalt, dto.newWrappedMasterKey);
    if (!rewrap.success) return rewrap;
    await this.repo.updateUser(user.id, { password: await argon2.hash(dto.newPassword), ...rewrap.data });
    await this.repo.deleteCodes(dto.email);
    return ok(null);
  }

  async changePassword(userId: string, dto: UpdatePasswordDto): Promise<Result<null>> {
    const user = await this.repo.findById(userId);
    if (!user || !user.password) return fail(400, 'Aucun mot de passe défini');
    if (!(await argon2.verify(user.password, dto.currentPassword))) return fail(401, 'Mot de passe actuel incorrect');
    const rewrap = this.checkRewrap(user.encryptionVersion, dto.newSalt, dto.newWrappedMasterKey);
    if (!rewrap.success) return rewrap;
    await this.repo.updateUser(userId, { password: await argon2.hash(dto.newPassword), ...rewrap.data });
    return ok(null);
  }

  async setPassword(userId: string, dto: SetPasswordDto): Promise<Result<null>> {
    const user = await this.repo.findById(userId);
    if (!user) return fail(404, 'Compte introuvable');
    const rewrap = this.checkRewrap(user.encryptionVersion, dto.newSalt, dto.newWrappedMasterKey);
    if (!rewrap.success) return rewrap;
    await this.repo.updateUser(userId, { password: await argon2.hash(dto.newPassword), ...rewrap.data });
    return ok(null);
  }

  async resendCode(email: string): Promise<Result<null>> {
    const user = await this.repo.findByEmail(email);
    if (user && !user.emailVerified) await this.sendCode(email, 'verification');
    return ok(null);
  }

  async setupTotp(userId: string): Promise<Result<{ qrCode: string; secret: string; uri: string }>> {
    const user = await this.repo.findById(userId);
    if (!user) return fail(404, 'Compte introuvable');
    const { secret, otpauthUri } = this.twoFactor.generateSecret(user.email);
    await this.repo.updateUser(userId, { totpSecret: secret });
    const qrCode = await this.twoFactor.buildQrDataUrl(otpauthUri);
    return ok({ qrCode, secret, uri: otpauthUri });
  }

  async enableTotp(userId: string, code: string): Promise<Result<null>> {
    const user = await this.repo.findById(userId);
    if (!user || !user.totpSecret) return fail(400, 'Aucun secret 2FA en attente');
    if (!this.twoFactor.verify(user.totpSecret, code)) return fail(400, 'Code 2FA invalide');
    await this.repo.updateUser(userId, { totpEnabled: new Date() });
    return ok(null);
  }

  async disableTotp(userId: string, password: string): Promise<Result<null>> {
    const user = await this.repo.findById(userId);
    if (!user || !user.password) return fail(400, 'Aucun mot de passe défini');
    if (!(await argon2.verify(user.password, password))) return fail(401, 'Mot de passe incorrect');
    await this.repo.updateUser(userId, { totpSecret: null, totpEnabled: null });
    return ok(null);
  }

  updateProfile(userId: string, displayName?: string): Promise<User> {
    return this.repo.updateUser(userId, { displayName: displayName ?? null });
  }
  getById(userId: string): Promise<User | undefined> { return this.repo.findById(userId); }

  private checkRewrap(version: number, newSalt?: string, newWrappedMasterKey?: string):
    Result<{ encryptionSalt?: string; wrappedMasterKey?: string }> {
    if (version === 1 && (!newSalt || !newWrappedMasterKey)) {
      return fail(400, 'Re-wrap de la clé de chiffrement requis');
    }
    return ok(newSalt && newWrappedMasterKey ? { encryptionSalt: newSalt, wrappedMasterKey: newWrappedMasterKey } : {});
  }

  private async sendCode(email: string, kind: 'verification' | 'reset'): Promise<void> {
    const code = genCode();
    await this.repo.insertCode(email, code, new Date(Date.now() + CODE_TTL_MS));
    if (kind === 'verification') await this.mailer.sendVerificationCode(email, code);
    else await this.mailer.sendPasswordResetCode(email, code);
  }
}
