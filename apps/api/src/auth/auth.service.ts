import { randomInt } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import {
  AuthRepository,
  type VerificationCodePurpose,
} from './auth.repository';
import { MAILER, type Mailer } from '../mail/mailer';
import { ok, fail, type Result } from './auth.result';
import { TwoFactorService } from './two-factor.service';
import { SecretCipherService } from './secret-cipher.service';
import { StorageService } from '../storage/storage.service';
import type { users } from '../db/schema';
import type {
  RegisterDto,
  VerifyDto,
  LoginDto,
  ResetPasswordDto,
  UpdatePasswordDto,
  SetPasswordDto,
} from './dto/auth.dto';

type User = typeof users.$inferSelect;
export type LoginOutcome =
  | { kind: 'authenticated'; user: User; backupCodesRemaining?: number }
  | { kind: 'mfa_required' };
const CODE_TTL_MS = 10 * 60 * 1000;
const genCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');
// hash factice précalculé : cible de argon2.verify sur le chemin « user inconnu » (anti-timing)
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$nDnJoEKnqivb4YJYimLDew$LsQ3NFQxFz3z6loo2TfhGsD7UEA5TiG67s9tn/ynstM';

@Injectable()
export class AuthService {
  constructor(
    private readonly repo: AuthRepository,
    @Inject(MAILER) private readonly mailer: Mailer,
    private readonly twoFactor: TwoFactorService,
    private readonly storage: StorageService,
    private readonly cipher: SecretCipherService,
  ) {}

  async register(dto: RegisterDto): Promise<Result<User>> {
    const existing = await this.repo.findByEmail(dto.email);
    if (existing) {
      // Coût argon2 payé dans les deux branches : le temps de réponse ne révèle pas l'existence.
      const hash = await argon2.hash(dto.password);
      if (existing.emailVerified) {
        await this.mailer.sendAccountExists(dto.email);
        return ok(existing);
      }
      // Compte jamais vérifié : il n'appartient à personne. Le mot de passe et le nom deviennent
      // ceux du nouvel inscrit, sinon le premier à avoir saisi l'e-mail (sans le posséder) garde
      // un mot de passe valide sur le compte que la vraie personne s'apprête à vérifier.
      const reclaimed = await this.repo.updateUser(existing.id, {
        password: hash,
        displayName: dto.displayName ?? null,
        totpSecret: null,
        totpEnabled: null,
      });
      await this.sendCode(dto.email, 'verification');
      return ok(reclaimed);
    }
    const hash = await argon2.hash(dto.password);
    const user = await this.repo.createUser({
      email: dto.email,
      password: hash,
      displayName: dto.displayName,
    });
    await this.sendCode(dto.email, 'verification');
    return ok(user);
  }

  async verify(dto: VerifyDto): Promise<Result<User>> {
    const valid = await this.repo.findValidCode(
      dto.email,
      dto.code,
      'verification',
    );
    if (!valid) return fail(400, 'Code invalide ou expiré');
    const user = await this.repo.findByEmail(dto.email);
    if (!user) return fail(404, 'Compte introuvable');
    const updated = await this.repo.updateUser(user.id, {
      emailVerified: new Date(),
    });
    await this.repo.deleteCodes(dto.email, 'verification');
    return ok(updated);
  }

  async login(dto: LoginDto): Promise<Result<LoginOutcome>> {
    const user = await this.repo.findByEmail(dto.email);
    if (!user || !user.password) {
      await argon2.verify(DUMMY_PASSWORD_HASH, dto.password); // anti-timing : égalise le coût avec le chemin « user trouvé »
      return fail(401, 'Identifiants invalides');
    }
    if (!(await argon2.verify(user.password, dto.password)))
      return fail(401, 'Identifiants invalides');
    if (!user.emailVerified)
      return fail(403, 'Email non vérifié', 'EMAIL_NOT_VERIFIED');
    if (user.totpEnabled && user.totpSecret) {
      // 2FA requis sans code fourni : ce n'est PAS une erreur mais une étape — succès 200
      // avec `kind: 'mfa_required'`, pour que le navigateur ne logue pas un 4xx en console.
      if (!dto.totpCode) return ok({ kind: 'mfa_required' });
      const code = dto.totpCode.trim();
      if (this.twoFactor.isTotpCode(code)) {
        const secret = await this.totpSecretOf(user);
        const step = this.twoFactor.verifyStep(secret, code);
        if (step === null || this.isReplayedTotp(user, step))
          return fail(401, 'Code 2FA invalide');
        await this.repo.updateUser(user.id, { totpLastUsedStep: step });
        return ok({ kind: 'authenticated', user });
      }
      // Code de secours : à usage unique, consommé atomiquement.
      const backup = this.twoFactor.normalizeBackupCode(code);
      if (
        !backup ||
        !(await this.repo.consumeBackupCode(user.id, this.cipher.hmac(backup)))
      )
        return fail(401, 'Code 2FA invalide');
      return ok({
        kind: 'authenticated',
        user,
        backupCodesRemaining: await this.repo.countUnusedBackupCodes(user.id),
      });
    }
    return ok({ kind: 'authenticated', user });
  }

  // Connexion au compte démo public, sans mot de passe (gatée par DEMO_ENABLED côté controller).
  async demoLogin(): Promise<Result<User>> {
    const user = await this.repo.findDemoAccount();
    if (!user) return fail(404, 'Compte démo indisponible');
    return ok(user);
  }

  async forgotPassword(email: string): Promise<Result<null>> {
    const user = await this.repo.findByEmail(email);
    if (user && user.emailVerified) await this.sendCode(email, 'reset');
    return ok(null);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<Result<null>> {
    const valid = await this.repo.findValidCode(dto.email, dto.code, 'reset');
    if (!valid) return fail(400, 'Code invalide ou expiré');
    const user = await this.repo.findByEmail(dto.email);
    if (!user) return fail(404, 'Compte introuvable');
    // Compte E2EE : changer le seul mot de passe laisserait la clé maîtresse emballée avec
    // l'ancien. Le code reste valide, le client enchaîne sur /auth/reset-password-with-recovery
    // avec la clé ré-emballée (ou l'effacement), à partir du blob de récupération renvoyé ici.
    if (user.encryptionVersion === 1) {
      return fail(
        409,
        'Compte chiffré : clé de récupération requise',
        'E2EE_RECOVERY_REQUIRED',
        { recoveryWrappedKey: user.recoveryWrappedKey },
      );
    }
    await this.repo.updateUser(user.id, {
      password: await argon2.hash(dto.newPassword),
    });
    await this.repo.bumpSessionVersion(user.id); // déconnecte un éventuel voleur de cookie
    await this.repo.deleteCodes(dto.email, 'reset');
    return ok(null);
  }

  /** Renvoie l'utilisateur mis à jour (session_version incrémentée) : le controller ré-émet le cookie. */
  async changePassword(
    userId: string,
    dto: UpdatePasswordDto,
  ): Promise<Result<User>> {
    const user = await this.repo.findById(userId);
    if (!user || !user.password) return fail(400, 'Aucun mot de passe défini');
    if (!(await argon2.verify(user.password, dto.currentPassword)))
      return fail(401, 'Mot de passe actuel incorrect');
    const rewrap = this.checkRewrap(
      user.encryptionVersion,
      dto.newSalt,
      dto.newWrappedMasterKey,
    );
    if (!rewrap.success) return rewrap;
    await this.repo.updateUser(userId, {
      password: await argon2.hash(dto.newPassword),
      ...rewrap.data,
    });
    return ok(await this.repo.bumpSessionVersion(userId));
  }

  async setPassword(
    userId: string,
    dto: SetPasswordDto,
  ): Promise<Result<null>> {
    const user = await this.repo.findById(userId);
    if (!user) return fail(404, 'Compte introuvable');
    const rewrap = this.checkRewrap(
      user.encryptionVersion,
      dto.newSalt,
      dto.newWrappedMasterKey,
    );
    if (!rewrap.success) return rewrap;
    await this.repo.updateUser(userId, {
      password: await argon2.hash(dto.newPassword),
      ...rewrap.data,
    });
    return ok(null);
  }

  async resendCode(email: string): Promise<Result<null>> {
    const user = await this.repo.findByEmail(email);
    if (user && !user.emailVerified) await this.sendCode(email, 'verification');
    return ok(null);
  }

  async setupTotp(
    userId: string,
  ): Promise<Result<{ qrCode: string; secret: string; uri: string }>> {
    const user = await this.repo.findById(userId);
    if (!user) return fail(404, 'Compte introuvable');
    // Un porteur de cookie volé ne doit pas pouvoir remplacer le 2FA par le sien : la
    // désactivation (mot de passe requis) est le seul chemin vers un ré-enrôlement.
    if (user.totpEnabled)
      return fail(
        409,
        'La 2FA est déjà active : désactivez-la avant de la reconfigurer',
      );
    const { secret, otpauthUri } = this.twoFactor.generateSecret(user.email);
    // Jamais en clair en base : un dump ne suffit pas à cloner l'authentificateur.
    await this.repo.updateUser(userId, {
      totpSecret: this.cipher.encrypt(secret),
    });
    const qrCode = await this.twoFactor.buildQrDataUrl(otpauthUri);
    return ok({ qrCode, secret, uri: otpauthUri });
  }

  /** Active la 2FA et renvoie les codes de secours — la seule fois où ils sont lisibles. */
  async enableTotp(
    userId: string,
    code: string,
  ): Promise<Result<{ backupCodes: string[] }>> {
    const user = await this.repo.findById(userId);
    if (!user || !user.totpSecret)
      return fail(400, 'Aucun secret 2FA en attente');
    if (user.totpEnabled) return fail(409, 'La 2FA est déjà active');
    const step = this.twoFactor.verifyStep(await this.totpSecretOf(user), code);
    if (step === null || this.isReplayedTotp(user, step))
      return fail(400, 'Code 2FA invalide');
    await this.repo.updateUser(userId, {
      totpEnabled: new Date(),
      totpLastUsedStep: step,
    });
    const backupCodes = await this.issueBackupCodes(userId);
    return ok({ backupCodes });
  }

  async backupCodesStatus(
    userId: string,
  ): Promise<Result<{ remaining: number }>> {
    const user = await this.repo.findById(userId);
    if (!user) return fail(404, 'Compte introuvable');
    if (!user.totpEnabled) return ok({ remaining: 0 });
    return ok({ remaining: await this.repo.countUnusedBackupCodes(userId) });
  }

  /** Nouveau jeu de 10 codes ; les anciens (utilisés ou non) ne valent plus. Mot de passe requis. */
  async regenerateBackupCodes(
    userId: string,
    password: string,
  ): Promise<Result<{ backupCodes: string[] }>> {
    const user = await this.repo.findById(userId);
    if (!user || !user.password) return fail(400, 'Aucun mot de passe défini');
    if (!user.totpEnabled) return fail(409, "La 2FA n'est pas active");
    if (!(await argon2.verify(user.password, password)))
      return fail(401, 'Mot de passe incorrect');
    return ok({ backupCodes: await this.issueBackupCodes(userId) });
  }

  private async issueBackupCodes(userId: string): Promise<string[]> {
    const codes = this.twoFactor.generateBackupCodes();
    await this.repo.replaceBackupCodes(
      userId,
      codes.map((c) => this.cipher.hmac(c)),
    );
    return codes;
  }

  /**
   * Secret TOTP en clair pour vérification. Les secrets antérieurs au chiffrement au repos
   * sont en clair en base : on les ré-écrit chiffrés au passage (migration opportuniste).
   */
  private async totpSecretOf(user: User): Promise<string> {
    const stored = user.totpSecret ?? '';
    if (stored && !this.cipher.isEncrypted(stored)) {
      await this.repo.updateUser(user.id, {
        totpSecret: this.cipher.encrypt(stored),
      });
      return stored;
    }
    return this.cipher.decrypt(stored);
  }

  /** Renvoie l'utilisateur mis à jour (session_version incrémentée) : le controller ré-émet le cookie. */
  async disableTotp(userId: string, password: string): Promise<Result<User>> {
    const user = await this.repo.findById(userId);
    if (!user || !user.password) return fail(400, 'Aucun mot de passe défini');
    if (!(await argon2.verify(user.password, password)))
      return fail(401, 'Mot de passe incorrect');
    await this.repo.updateUser(userId, {
      totpSecret: null,
      totpEnabled: null,
      totpLastUsedStep: null,
    });
    await this.repo.deleteBackupCodes(userId);
    return ok(await this.repo.bumpSessionVersion(userId));
  }

  async deleteAccount(userId: string): Promise<Result<null>> {
    const user = await this.repo.findById(userId);
    if (user?.isDemoAccount)
      return fail(403, 'Le compte démo ne peut pas être supprimé');
    await this.storage.deletePrefix(`avatars/${userId}`);
    await this.storage.deletePrefix(`prescriptions/${userId}/`);
    await this.storage.deletePrefix(`documents/${userId}/`);
    await this.storage.deletePrefix(`payslips/${userId}/`);
    await this.repo.deleteUser(userId);
    return ok(null);
  }

  /** Logout : invalide TOUS les JWT du compte (tous les appareils), pas seulement le cookie courant. */
  revokeSessions(userId: string): Promise<User> {
    return this.repo.bumpSessionVersion(userId);
  }

  private isReplayedTotp(user: User, step: number): boolean {
    return user.totpLastUsedStep != null && step <= user.totpLastUsedStep;
  }

  updateProfile(userId: string, displayName?: string): Promise<User> {
    return this.repo.updateUser(userId, { displayName: displayName ?? null });
  }
  getById(userId: string): Promise<User | undefined> {
    return this.repo.findById(userId);
  }
  setAvatar(userId: string, key: string): Promise<User> {
    return this.repo.updateUser(userId, { avatarUrl: key });
  }

  private checkRewrap(
    version: number,
    newSalt?: string,
    newWrappedMasterKey?: string,
  ): Result<{ encryptionSalt?: string; wrappedMasterKey?: string }> {
    if (version === 1 && (!newSalt || !newWrappedMasterKey)) {
      return fail(400, 'Re-wrap de la clé de chiffrement requis');
    }
    return ok(
      newSalt && newWrappedMasterKey
        ? { encryptionSalt: newSalt, wrappedMasterKey: newWrappedMasterKey }
        : {},
    );
  }

  private async sendCode(
    email: string,
    kind: VerificationCodePurpose,
  ): Promise<void> {
    const code = genCode();
    await this.repo.insertCode(
      email,
      code,
      new Date(Date.now() + CODE_TTL_MS),
      kind,
    );
    if (kind === 'verification')
      await this.mailer.sendVerificationCode(email, code);
    else await this.mailer.sendPasswordResetCode(email, code);
  }
}
