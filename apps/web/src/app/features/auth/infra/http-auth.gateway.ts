import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { AuthUser } from '../domain/models/auth-user.model';
import { KeyMaterial } from '../domain/models/key-material.model';

export type LoginResponse =
  | { mfaRequired: true }
  | {
      token?: string;
      user: AuthUser;
      keyMaterial?: KeyMaterial;
      /** Jeton anti-CSRF de la session ouverte (HMAC côté serveur, sans cookie). */
      csrfToken?: string;
      /** Présent si la connexion a consommé un code de secours 2FA. */
      backupCodesRemaining?: number;
    };

// Une seule implémentation : classe concrète directe (YAGNI gateway), pas d'abstract.
@Injectable({ providedIn: 'root' })
export class HttpAuthGateway {
  private readonly api = inject(ApiClient);

  getCsrfToken(): Observable<{ csrfToken: string }> {
    return this.api.get('/auth/csrf');
  }

  getMe(): Observable<AuthUser & { keyMaterial?: KeyMaterial }> {
    return this.api.get('/auth/me');
  }

  register(email: string, password: string, displayName?: string): Observable<void> {
    return this.api.post('/auth/register', { email, password, displayName });
  }

  demoLogin(): Observable<{
    token: string;
    user: AuthUser;
    keyMaterial: null;
    csrfToken?: string;
  }> {
    return this.api.post('/auth/demo-login', {});
  }

  verifyCode(
    email: string,
    code: string,
  ): Observable<{
    token: string;
    user: AuthUser;
    keyMaterial?: KeyMaterial;
    csrfToken?: string;
  }> {
    return this.api.post('/auth/verify', { email, code });
  }

  resendCode(email: string): Observable<void> {
    return this.api.post('/auth/resend-code', { email });
  }

  login(email: string, password: string, totpCode?: string): Observable<LoginResponse> {
    return this.api.post('/auth/login', { email, password, totpCode });
  }

  forgotPassword(email: string): Observable<void> {
    return this.api.post('/auth/forgot-password', { email });
  }

  resetPassword(email: string, code: string, newPassword: string): Observable<void> {
    return this.api.post('/auth/reset-password', { email, code, newPassword });
  }

  logout(): Observable<void> {
    return this.api.post('/auth/logout', {});
  }

  updateProfile(data: { displayName?: string }): Observable<AuthUser> {
    return this.api.patch('/auth/me', data);
  }

  uploadAvatar(formData: FormData): Observable<AuthUser> {
    return this.api.postForm('/auth/me/avatar', formData);
  }

  setup2FA(): Observable<{ qrCode: string; secret: string }> {
    return this.api.post('/auth/me/2fa/setup', {});
  }

  /** Active la 2FA ; les codes de secours ne sont renvoyés qu'ici, une seule fois. */
  verify2FA(code: string): Observable<{ backupCodes: string[] }> {
    return this.api.post('/auth/me/2fa/verify', { code });
  }

  backupCodesStatus(): Observable<{ remaining: number }> {
    return this.api.get('/auth/me/2fa/backup-codes');
  }

  regenerateBackupCodes(password: string): Observable<{ backupCodes: string[] }> {
    return this.api.post('/auth/me/2fa/backup-codes', { password });
  }

  disable2FA(password: string): Observable<void> {
    return this.api.post('/auth/me/2fa/disable', { password });
  }

  updatePassword(body: Record<string, string>): Observable<void> {
    return this.api.patch('/auth/me/password', body);
  }

  setPassword(body: Record<string, string>): Observable<void> {
    return this.api.post('/auth/me/set-password', body);
  }

  deleteAccount(): Observable<void> {
    return this.api.delete('/auth/me');
  }

  patchEncryptionKeys(keyMaterial: KeyMaterial): Observable<void> {
    return this.api.patch('/auth/me/encryption-keys', keyMaterial);
  }

  migrateEncryption(
    keyMaterial: KeyMaterial,
    data: Record<string, { id: string; encryptedData: string }[]>,
  ): Observable<void> {
    return this.api.post('/auth/me/migrate-encryption', { keyMaterial, data });
  }
}
