import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { AuthUser } from '../domain/models/auth-user.model';
import { KeyMaterial } from '../domain/models/key-material.model';
import { SecurityEvent } from '../domain/models/security-event.model';

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

  // `authKey` / `secret` : jamais le mot de passe. Les stores dérivent la clé d'authentification
  // (deriveAuthKey) avant d'appeler ce gateway ; seul un compte pas encore migré présente encore
  // son mot de passe, le temps d'un login.
  register(email: string, authKey: string, displayName?: string): Observable<void> {
    return this.api.post('/auth/register', { email, password: authKey, displayName });
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

  /** Ce que le serveur attend pour cet e-mail : 1 = clé d'authentification, 0 = mot de passe (compte pas encore migré). */
  prelogin(email: string): Observable<{ authVersion: number }> {
    return this.api.post('/auth/prelogin', { email });
  }

  login(email: string, secret: string, totpCode?: string): Observable<LoginResponse> {
    return this.api.post('/auth/login', { email, password: secret, totpCode });
  }

  /** Bascule le compte sur la clé d'authentification, juste après un login au mot de passe. */
  upgradeAuth(currentPassword: string, authKey: string): Observable<AuthUser> {
    return this.api.post('/auth/me/upgrade-auth', { currentPassword, authKey });
  }

  forgotPassword(email: string): Observable<void> {
    return this.api.post('/auth/forgot-password', { email });
  }

  resetPassword(email: string, code: string, authKey: string): Observable<void> {
    return this.api.post('/auth/reset-password', { email, code, newPassword: authKey });
  }

  /** Reset d'un compte chiffré : clé maîtresse ré-emballée, ou effacement si la clé de récupération est perdue. */
  resetPasswordWithRecovery(
    body: { email: string; code: string; newPassword: string } & (
      | { newSalt: string; newWrappedMasterKey: string }
      | { wipe: true }
    ),
  ): Observable<void> {
    return this.api.post('/auth/reset-password-with-recovery', body);
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

  getSecurityEvents(limit = 30): Observable<SecurityEvent[]> {
    return this.api.get('/auth/me/security-events', { limit });
  }

  backupCodesStatus(): Observable<{ remaining: number }> {
    return this.api.get('/auth/me/2fa/backup-codes');
  }

  regenerateBackupCodes(secret: string): Observable<{ backupCodes: string[] }> {
    return this.api.post('/auth/me/2fa/backup-codes', { password: secret });
  }

  disable2FA(secret: string): Observable<void> {
    return this.api.post('/auth/me/2fa/disable', { password: secret });
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

  /** `currentPassword` : exigé par le serveur quand des clés existent déjà (remplacement). */
  patchEncryptionKeys(keyMaterial: KeyMaterial, currentSecret?: string): Observable<void> {
    return this.api.patch('/auth/me/encryption-keys', {
      ...keyMaterial,
      currentPassword: currentSecret,
    });
  }

  /** Compte OAuth : signale qu'une passphrase protège les clés. La passphrase ne quitte pas le client. */
  markEncryptionPassphrase(): Observable<void> {
    return this.api.post('/auth/me/encryption-passphrase', {});
  }

  migrateEncryption(
    keyMaterial: KeyMaterial,
    data: Record<string, { id: string; encryptedData: string }[]>,
  ): Observable<void> {
    return this.api.post('/auth/me/migrate-encryption', { keyMaterial, data });
  }
}
