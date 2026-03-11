import { computed, inject, Injectable, signal } from '@angular/core';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { firstValueFrom } from 'rxjs';

export type KeyMaterial = {
  salt: string;
  wrappedMasterKey: string;
  recoveryWrappedKey: string | null;
};

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  totpEnabled: boolean;
  hasPassword: boolean;
  googleLinked: boolean;
  encryptionVersion: number;
  hasEncryptionPassphrase: boolean;
};

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  private readonly _user = signal<AuthUser | null>(null);
  private readonly _isAuthenticated = signal(false);
  private readonly _isLoading = signal(true);
  private _keyMaterial: KeyMaterial | null = null;

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
    // Backend returns relative path like /api/auth/avatar/:id
    return url;
  });
  readonly totpEnabled = computed(() => this._user()?.totpEnabled ?? false);
  readonly userInitial = computed(() => {
    const name = this.displayName();
    return name ? name.charAt(0).toUpperCase() : '?';
  });
  readonly encryptionVersion = computed(() => this._user()?.encryptionVersion ?? 0);
  readonly needsEncryptionSetup = computed(() => this.isAuthenticated() && this.encryptionVersion() === 0);
  readonly needsUnlock = computed(() => this.isAuthenticated() && this.encryptionVersion() === 1 && !this.crypto.isUnlocked());

  constructor() {
    this.checkSession();
  }

  async checkSession(): Promise<void> {
    this._isLoading.set(true);
    const token = this.api.getToken();
    if (!token) {
      this._user.set(null);
      this._isAuthenticated.set(false);
      this._isLoading.set(false);
      return;
    }

    try {
      const res = await firstValueFrom(this.api.get<AuthUser & { keyMaterial?: KeyMaterial }>('/auth/me'));
      const { keyMaterial, ...user } = res;
      this._user.set(user);
      this._isAuthenticated.set(true);
      this._keyMaterial = keyMaterial ?? null;

      // Try to restore crypto from session
      if (user.encryptionVersion === 1) {
        await this.crypto.restoreFromSession();
      }
    } catch {
      this.api.clearToken();
      this._user.set(null);
      this._isAuthenticated.set(false);
    } finally {
      this._isLoading.set(false);
    }
  }

  async register(email: string, password: string, displayName?: string): Promise<void> {
    await firstValueFrom(
      this.api.post('/auth/register', { email, password, displayName }),
    );
  }

  async verifyCode(email: string, code: string): Promise<void> {
    const res = await firstValueFrom(
      this.api.post<{ token: string; user: AuthUser; keyMaterial?: KeyMaterial }>('/auth/verify', { email, code }),
    );
    this.api.setToken(res.token);
    this._user.set(res.user);
    this._isAuthenticated.set(true);
    this._keyMaterial = res.keyMaterial ?? null;
  }

  async resendCode(email: string): Promise<void> {
    await firstValueFrom(
      this.api.post('/auth/resend-code', { email }),
    );
  }

  async login(email: string, password: string, totpCode?: string): Promise<void> {
    const res = await firstValueFrom(
      this.api.post<{ token: string; user: AuthUser; keyMaterial?: KeyMaterial }>('/auth/login', { email, password, totpCode }),
    );
    this.api.setToken(res.token);
    this._user.set(res.user);
    this._isAuthenticated.set(true);
    this._keyMaterial = res.keyMaterial ?? null;

    // Auto-unlock if encryption is set up
    if (res.keyMaterial && res.user.encryptionVersion === 1) {
      await this.crypto.unlock(password, res.keyMaterial.salt, res.keyMaterial.wrappedMasterKey);
    }
  }

  async forgotPassword(email: string): Promise<void> {
    await firstValueFrom(
      this.api.post('/auth/forgot-password', { email }),
    );
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    await firstValueFrom(
      this.api.post('/auth/reset-password', { email, code, newPassword }),
    );
  }

  async loginWithToken(token: string): Promise<void> {
    this.api.setToken(token);
    const user = await firstValueFrom(this.api.get<AuthUser>('/auth/me'));
    this._user.set(user);
    this._isAuthenticated.set(true);
  }

  async logout(): Promise<void> {
    this.crypto.lock();
    this.api.clearToken();
    this._user.set(null);
    this._isAuthenticated.set(false);
    this._keyMaterial = null;
  }

  async updateProfile(data: { displayName?: string }): Promise<void> {
    const user = await firstValueFrom(this.api.patch<AuthUser>('/auth/me', data));
    this._user.set(user);
  }

  async uploadAvatar(file: File): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    const user = await firstValueFrom(this.api.postForm<AuthUser>('/auth/me/avatar', formData));
    this._user.set(user);
  }

  // ── 2FA ──
  async setup2FA(): Promise<{ qrCode: string; secret: string }> {
    return firstValueFrom(
      this.api.post<{ qrCode: string; secret: string }>('/auth/me/2fa/setup', {}),
    );
  }

  async verify2FA(code: string): Promise<void> {
    await firstValueFrom(this.api.post('/auth/me/2fa/verify', { code }));
    const user = this._user();
    if (user) this._user.set({ ...user, totpEnabled: true });
  }

  async disable2FA(password: string): Promise<void> {
    await firstValueFrom(this.api.post('/auth/me/2fa/disable', { password }));
    const user = this._user();
    if (user) this._user.set({ ...user, totpEnabled: false });
  }

  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    await firstValueFrom(
      this.api.patch('/auth/me/password', { currentPassword, newPassword }),
    );
  }

  async deleteAccount(): Promise<void> {
    await firstValueFrom(this.api.delete('/auth/me'));
    await this.logout();
  }

  // ── E2EE Methods ──

  getKeyMaterial(): KeyMaterial | null {
    return this._keyMaterial;
  }

  async unlockWithPassword(password: string): Promise<void> {
    if (!this._keyMaterial) throw new Error('No key material available');
    await this.crypto.unlock(password, this._keyMaterial.salt, this._keyMaterial.wrappedMasterKey);
  }

  async unlockWithRecovery(recoveryHex: string): Promise<void> {
    if (!this._keyMaterial?.recoveryWrappedKey) throw new Error('No recovery key material');
    await this.crypto.unlockWithRecovery(recoveryHex, this._keyMaterial.recoveryWrappedKey);
  }

  async setupEncryption(password: string): Promise<string> {
    const masterKey = await this.crypto.generateMasterKey();
    const salt = this.crypto.generateSalt();
    const recoveryKey = this.crypto.generateRecoveryKey();

    const wrappingKey = await this.crypto.deriveWrappingKey(password, salt);
    const recoveryWrappingKey = await this.crypto.deriveWrappingKeyFromRecovery(recoveryKey);

    const wrappedMasterKey = await this.crypto.wrapKey(masterKey, wrappingKey);
    const recoveryWrappedKey = await this.crypto.wrapKey(masterKey, recoveryWrappingKey);

    const { bytesToHex } = await import('@core/services/crypto/crypto.store');
    const saltHex = bytesToHex(salt);

    this._keyMaterial = { salt: saltHex, wrappedMasterKey, recoveryWrappedKey };

    return recoveryKey;
  }

  async saveEncryptionKeys(): Promise<void> {
    if (!this._keyMaterial) throw new Error('No key material');
    await firstValueFrom(
      this.api.patch('/auth/me/encryption-keys', this._keyMaterial),
    );
    const user = this._user();
    if (user) this._user.set({ ...user, encryptionVersion: 1 });
  }

  async migrateEncryption(data: Record<string, Array<{ id: string; encryptedData: string }>>): Promise<void> {
    if (!this._keyMaterial) throw new Error('No key material');
    await firstValueFrom(
      this.api.post('/auth/me/migrate-encryption', {
        keyMaterial: this._keyMaterial,
        data,
      }),
    );
    const user = this._user();
    if (user) this._user.set({ ...user, encryptionVersion: 1 });
  }

  async updatePasswordWithReWrap(currentPassword: string, newPassword: string): Promise<void> {
    const masterKey = this.crypto.getMasterKey();
    if (!masterKey) throw new Error('CryptoStore is locked');

    const salt = this.crypto.generateSalt();
    const wrappingKey = await this.crypto.deriveWrappingKey(newPassword, salt);
    const wrappedMasterKey = await this.crypto.wrapKey(masterKey, wrappingKey);
    const { bytesToHex } = await import('@core/services/crypto/crypto.store');
    const saltHex = bytesToHex(salt);

    await firstValueFrom(
      this.api.patch('/auth/me/password', {
        currentPassword,
        newPassword,
        newSalt: saltHex,
        newWrappedMasterKey: wrappedMasterKey,
      }),
    );

    this._keyMaterial = { ...this._keyMaterial!, salt: saltHex, wrappedMasterKey };
  }
}
