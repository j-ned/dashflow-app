import { computed, inject, Injectable, signal } from '@angular/core';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { AutoLockStore } from '@core/services/crypto/auto-lock.store';
import { CsrfStore } from '@core/services/csrf/csrf-store';
import { validateOne } from '@core/services/crypto/validate-decrypted';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { HttpAuthGateway } from './infra/http-auth.gateway';
import { AuthUserSchema } from './infra/schemas/auth-user.schema';
import { AuthUser } from './domain/models/auth-user.model';
import { KeyMaterial } from './domain/models/key-material.model';

// Store de session/identité : signals-first, consomme HttpAuthGateway (infra/).
// Le cycle de vie E2EE (unlock, setup, migration, rewrap) vit dans AuthEncryptionStore
// (cf. audit F008) : cette classe ne connaît que le keyMaterial brut, pas la cryptographie.
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly gateway = inject(HttpAuthGateway);
  private readonly crypto = inject(CryptoStore);
  private readonly autoLock = inject(AutoLockStore);
  private readonly csrf = inject(CsrfStore);

  private readonly _user = signal<AuthUser | null>(null);
  private readonly _isAuthenticated = signal(false);
  private readonly _isLoading = signal(true);
  private _keyMaterial: KeyMaterial | null = null;
  // Le constructeur ET les guards fonctionnels (authGuard/guestGuard/adminGuard) appellent
  // checkSession() dès que isLoading() est vrai : mémoïser la requête en vol évite un
  // /auth/csrf + /auth/me concurrent à chaque démarrage à froid (cf. audit F006).
  private _sessionPromise: Promise<void> | null = null;

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = this._isAuthenticated.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  readonly email = computed(() => this._user()?.email ?? '');
  readonly displayName = computed(() => {
    const user = this._user();
    return user?.displayName ?? user?.email?.split('@')[0] ?? '';
  });
  readonly avatarUrl = computed(() => {
    const url = this._user()?.avatarUrl;
    if (!url) return null;
    return `${environment.apiUrl}${url}`;
  });
  readonly isAdmin = computed(() => this._user()?.role === 'admin');
  readonly totpEnabled = computed(() => this._user()?.totpEnabled ?? false);
  readonly userInitial = computed(() => {
    const name = this.displayName();
    return name ? name.charAt(0).toUpperCase() : '?';
  });
  readonly hasPassword = computed(() => this._user()?.hasPassword ?? false);
  readonly encryptionVersion = computed(() => this._user()?.encryptionVersion ?? 0);
  readonly needsEncryptionSetup = computed(
    () => this.isAuthenticated() && this.encryptionVersion() === 0 && !this._user()?.isDemoAccount,
  );

  readonly needsUnlock = computed(
    () =>
      this.isAuthenticated() &&
      this.encryptionVersion() === 1 &&
      !this.crypto.isUnlocked() &&
      !this._user()?.isDemoAccount,
  );

  constructor() {
    this.checkSession();
  }

  async checkSession(): Promise<void> {
    if (!this._sessionPromise) {
      this._sessionPromise = this.performCheckSession().finally(() => {
        this._sessionPromise = null;
      });
    }
    return this._sessionPromise;
  }

  private async performCheckSession(): Promise<void> {
    this._isLoading.set(true);
    try {
      const res = await firstValueFrom(this.gateway.getMe());
      // Le jeton CSRF est dérivé de la session : il n'existe qu'une fois celle-ci confirmée.
      const { csrfToken } = await firstValueFrom(this.gateway.getCsrfToken());
      this.csrf.setToken(csrfToken);
      const { keyMaterial, ...rawUser } = res;
      const user = validateOne(AuthUserSchema, rawUser, { entity: 'AuthUser' });
      this._user.set(user);
      this._isAuthenticated.set(true);
      this._keyMaterial = keyMaterial ?? null;

      if (user.encryptionVersion === 1) {
        // Rechargement après une longue absence : on verrouille au lieu de restaurer la clé.
        if (this.autoLock.isExpired()) await this.crypto.lock();
        else await this.crypto.restoreFromStorage();
      }
    } catch {
      this._isAuthenticated.set(false);
    } finally {
      this._isLoading.set(false);
    }
  }

  async register(email: string, password: string, displayName?: string): Promise<void> {
    await firstValueFrom(this.gateway.register(email, password, displayName));
  }

  async demoLogin(): Promise<void> {
    this._isLoading.set(true);
    try {
      const res = await firstValueFrom(this.gateway.demoLogin());
      this.csrf.setToken(res.csrfToken ?? null);
      this._user.set(res.user);
      this._isAuthenticated.set(true);
      this._keyMaterial = null;
    } finally {
      this._isLoading.set(false);
    }
  }

  async verifyCode(email: string, code: string): Promise<void> {
    const res = await firstValueFrom(this.gateway.verifyCode(email, code));
    this.csrf.setToken(res.csrfToken ?? null);
    this._user.set(res.user);
    this._isAuthenticated.set(true);
    this._keyMaterial = res.keyMaterial ?? null;
  }

  async resendCode(email: string): Promise<void> {
    await firstValueFrom(this.gateway.resendCode(email));
  }

  async login(
    email: string,
    password: string,
    totpCode?: string,
  ): Promise<'authenticated' | 'mfa_required'> {
    const res = await firstValueFrom(this.gateway.login(email, password, totpCode));
    // 2FA activé sans code : le backend renvoie 200 + { mfaRequired: true } (pas une erreur).
    if ('mfaRequired' in res) return 'mfa_required';

    // Renseigné seulement quand un code de secours a servi : la page de login prévient.
    this._lastBackupCodesRemaining.set(res.backupCodesRemaining ?? null);
    this.csrf.setToken(res.csrfToken ?? null);
    this._user.set(res.user);
    this._isAuthenticated.set(true);
    this._keyMaterial = res.keyMaterial ?? null;

    if (res.keyMaterial && res.user.encryptionVersion === 1) {
      try {
        await this.crypto.unlock(password, res.keyMaterial.salt, res.keyMaterial.wrappedMasterKey);
      } catch {
        // Auto-unlock failed: passphrase differs from login password.
        // User will be redirected to /auth/unlock to enter their passphrase manually.
      }
    }
    return 'authenticated';
  }

  async forgotPassword(email: string): Promise<void> {
    await firstValueFrom(this.gateway.forgotPassword(email));
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    await firstValueFrom(this.gateway.resetPassword(email, code, newPassword));
  }

  async hydrateFromCookie(): Promise<void> {
    const res = await firstValueFrom(this.gateway.getMe());
    // Retour OAuth : la session vient d'être posée par redirection, le jeton CSRF reste à prendre.
    const { csrfToken } = await firstValueFrom(this.gateway.getCsrfToken());
    this.csrf.setToken(csrfToken);
    const { keyMaterial, ...rawUser } = res;
    this._user.set(validateOne(AuthUserSchema, rawUser, { entity: 'AuthUser' }));
    this._isAuthenticated.set(true);
    this._keyMaterial = keyMaterial ?? null;
  }

  async logout(): Promise<void> {
    await this.crypto.lock();
    try {
      await firstValueFrom(this.gateway.logout());
    } catch {
      /* non-blocking */
    }
    this._user.set(null);
    this._isAuthenticated.set(false);
    this._keyMaterial = null;
    this.csrf.setToken(null); // le jeton est lié à la session révoquée
  }

  async updateProfile(data: { displayName?: string }): Promise<void> {
    const user = await firstValueFrom(this.gateway.updateProfile(data));
    this._user.set(user);
  }

  async uploadAvatar(file: File): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    const user = await firstValueFrom(this.gateway.uploadAvatar(formData));
    this._user.set(user);
  }

  // ── 2FA ──
  private readonly _lastBackupCodesRemaining = signal<number | null>(null);
  /** Codes de secours restants après une connexion par code de secours (sinon `null`). */
  readonly lastBackupCodesRemaining = this._lastBackupCodesRemaining.asReadonly();

  async setup2FA(): Promise<{ qrCode: string; secret: string }> {
    return firstValueFrom(this.gateway.setup2FA());
  }

  /** Renvoie les codes de secours : c'est la seule occasion de les afficher. */
  async verify2FA(code: string): Promise<string[]> {
    const { backupCodes } = await firstValueFrom(this.gateway.verify2FA(code));
    const user = this._user();
    if (user) this._user.set({ ...user, totpEnabled: true });
    return backupCodes ?? [];
  }

  async backupCodesRemaining(): Promise<number> {
    const { remaining } = await firstValueFrom(this.gateway.backupCodesStatus());
    return remaining;
  }

  async regenerateBackupCodes(password: string): Promise<string[]> {
    const { backupCodes } = await firstValueFrom(this.gateway.regenerateBackupCodes(password));
    return backupCodes;
  }

  async disable2FA(password: string): Promise<void> {
    await firstValueFrom(this.gateway.disable2FA(password));
    const user = this._user();
    if (user) this._user.set({ ...user, totpEnabled: false });
  }

  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    await firstValueFrom(this.gateway.updatePassword({ currentPassword, newPassword }));
  }

  async setPassword(newPassword: string): Promise<void> {
    const body: Record<string, string> = { newPassword };

    // If crypto is unlocked, re-wrap master key with the new password
    // so future email+password logins auto-unlock E2EE transparently
    const masterKey = this.crypto.getRewrappableMasterKey();
    if (masterKey) {
      const salt = this.crypto.generateSalt();
      const wrappingKey = await this.crypto.deriveWrappingKey(newPassword, salt);
      const wrappedMasterKey = await this.crypto.wrapKey(masterKey, wrappingKey);
      const { bytesToHex } = await import('@core/services/crypto/crypto.store');
      body['newSalt'] = bytesToHex(salt);
      body['newWrappedMasterKey'] = wrappedMasterKey;
    } else if (this._user()?.encryptionVersion === 1) {
      // E2EE actif mais session verrouillée (ex. compte OAuth déverrouillé par passphrase,
      // jamais déverrouillé cette session) : le backend rejette sans les champs de rewrap
      // (cf. checkRewrap côté serveur). Échec explicite plutôt qu'un 400 masqué par l'appelant.
      throw new Error('E2EE_LOCKED');
    }

    await firstValueFrom(this.gateway.setPassword(body));
    const user = this._user();
    if (user) this._user.set({ ...user, hasPassword: true, hasEncryptionPassphrase: false });

    // Update local key material
    if (body['newSalt'] && body['newWrappedMasterKey']) {
      this._keyMaterial = {
        recoveryWrappedKey: this._keyMaterial?.recoveryWrappedKey ?? null,
        salt: body['newSalt'],
        wrappedMasterKey: body['newWrappedMasterKey'],
      };
    }
  }

  async deleteAccount(): Promise<void> {
    await firstValueFrom(this.gateway.deleteAccount());
    await this.logout();
  }

  getKeyMaterial(): KeyMaterial | null {
    return this._keyMaterial;
  }

  /** Consommé par AuthEncryptionStore après un rewrap réussi (repairWithRecovery, updatePasswordWithReWrap). */
  updateKeyMaterial(keyMaterial: KeyMaterial): void {
    this._keyMaterial = keyMaterial;
  }

  /** Consommé par AuthEncryptionStore après setupEncryption/migrateEncryption réussis. */
  setEncryptionVersion(version: number): void {
    const user = this._user();
    if (user) this._user.set({ ...user, encryptionVersion: version });
  }
}
