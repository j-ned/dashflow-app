import { inject, Injectable } from '@angular/core';
import { CryptoStore, bytesToHex } from '@core/services/crypto/crypto.store';
import { AuthStore } from './auth.store';
import { deriveAuthKey } from '@core/services/crypto/auth-key';
import { HttpAuthGateway } from './infra/http-auth.gateway';
import { firstValueFrom } from 'rxjs';

// Cycle de vie E2EE (unlock, setup, migration, rewrap) extrait de AuthStore (cf. audit F008 :
// AuthStore cumulait 27 méthodes publiques / 6 responsabilités). Dépendance à sens unique vers
// AuthStore (lecture du keyMaterial, écriture via les setters dédiés updateKeyMaterial/
// setEncryptionVersion) : AuthStore ne connaît jamais cette classe, pas de cycle DI.
@Injectable({ providedIn: 'root' })
export class AuthEncryptionStore {
  private readonly auth = inject(AuthStore);
  private readonly crypto = inject(CryptoStore);
  private readonly gateway = inject(HttpAuthGateway);

  async unlockWithPassword(password: string): Promise<void> {
    const keyMaterial = this.auth.getKeyMaterial();
    if (!keyMaterial) throw new Error('No key material available');
    await this.crypto.unlock(password, keyMaterial.salt, keyMaterial.wrappedMasterKey);
  }

  async unlockWithRecovery(recoveryHex: string): Promise<void> {
    const keyMaterial = this.auth.getKeyMaterial();
    if (!keyMaterial?.recoveryWrappedKey) throw new Error('No recovery key material');
    await this.crypto.unlockWithRecovery(recoveryHex, keyMaterial.recoveryWrappedKey);
  }

  async repairWithRecovery(recoveryHex: string, password: string): Promise<void> {
    const keyMaterial = this.auth.getKeyMaterial();
    if (!keyMaterial?.recoveryWrappedKey) throw new Error('No recovery key material');

    await this.crypto.unlockWithRecovery(recoveryHex, keyMaterial.recoveryWrappedKey);
    const masterKey = this.crypto.getRewrappableMasterKey();
    if (!masterKey) throw new Error('Failed to unlock with recovery');

    const { saltHex, wrappedMasterKey } = await this.wrapWithPassword(masterKey, password);
    const recoveryWrappedKey = keyMaterial.recoveryWrappedKey;

    // Remplacer des clés existantes : le serveur exige le mot de passe courant.
    await firstValueFrom(
      this.gateway.patchEncryptionKeys(
        { salt: saltHex, wrappedMasterKey, recoveryWrappedKey },
        await this.auth.presentedSecret(password),
      ),
    );

    this.auth.updateKeyMaterial({ salt: saltHex, wrappedMasterKey, recoveryWrappedKey });
  }

  /**
   * Mot de passe oublié sur un compte chiffré, hors session : ouvre la clé maîtresse avec la clé
   * de récupération, la ré-emballe avec le nouveau mot de passe, et envoie le tout en une requête.
   * La clé ne reste pas déverrouillée : personne n'est connecté à ce stade.
   */
  async resetPasswordWithRecovery(reset: {
    email: string;
    code: string;
    newPassword: string;
    recoveryHex: string;
    recoveryWrappedKey: string;
  }): Promise<void> {
    await this.crypto.unlockWithRecovery(reset.recoveryHex, reset.recoveryWrappedKey);
    try {
      const masterKey = this.crypto.getRewrappableMasterKey();
      if (!masterKey) throw new Error('Failed to unlock with recovery');
      const { saltHex, wrappedMasterKey } = await this.wrapWithPassword(
        masterKey,
        reset.newPassword,
      );
      await firstValueFrom(
        this.gateway.resetPasswordWithRecovery({
          email: reset.email,
          code: reset.code,
          newPassword: await deriveAuthKey(reset.newPassword, reset.email),
          newSalt: saltHex,
          newWrappedMasterKey: wrappedMasterKey,
        }),
      );
    } finally {
      await this.crypto.lock();
    }
  }

  /** Clé de récupération perdue : nouveau mot de passe, données chiffrées et clés effacées. */
  async resetPasswordWithWipe(email: string, code: string, newPassword: string): Promise<void> {
    await firstValueFrom(
      this.gateway.resetPasswordWithRecovery({
        email,
        code,
        newPassword: await deriveAuthKey(newPassword, email),
        wipe: true,
      }),
    );
  }

  /** Compte OAuth : une passphrase (qui ne quitte jamais le client) protégera les clés. */
  async markPassphraseProtected(): Promise<void> {
    await firstValueFrom(this.gateway.markEncryptionPassphrase());
  }

  /**
   * Remplace la clé de récupération. `secret` est ce qui déverrouille les données (mot de passe,
   * ou passphrase d'un compte Google) : il rouvre la clé maîtresse même après un rechargement et
   * sert de réauthentification au serveur. La nouvelle clé n'est renvoyée qu'une fois enregistrée
   * côté serveur : avant, elle n'ouvrirait rien.
   */
  async rotateRecoveryKey(secret: string): Promise<string> {
    const keyMaterial = this.auth.getKeyMaterial();
    if (!keyMaterial) throw new Error('No key material');
    await this.crypto.unlock(secret, keyMaterial.salt, keyMaterial.wrappedMasterKey);
    const masterKey = this.crypto.getRewrappableMasterKey();
    if (!masterKey) throw new Error('CryptoStore is locked');

    const recoveryKey = this.crypto.generateRecoveryKey();
    const recoveryWrappingKey = await this.crypto.deriveWrappingKeyFromRecovery(recoveryKey);
    const rotated = {
      ...keyMaterial,
      recoveryWrappedKey: await this.crypto.wrapKey(masterKey, recoveryWrappingKey),
    };
    await firstValueFrom(
      this.gateway.patchEncryptionKeys(
        rotated,
        this.auth.user()?.hasPassword ? await this.auth.presentedSecret(secret) : undefined,
      ),
    );
    this.auth.updateKeyMaterial(rotated);
    return recoveryKey;
  }

  /** Vrai si cette clé de récupération ouvre bien la clé maîtresse du compte. Rien n'est modifié. */
  async verifyRecoveryKey(recoveryHex: string): Promise<boolean> {
    const wrapped = this.auth.getKeyMaterial()?.recoveryWrappedKey;
    if (!wrapped) throw new Error('No recovery key material');
    try {
      const wrappingKey = await this.crypto.deriveWrappingKeyFromRecovery(recoveryHex);
      await this.crypto.unwrapKey(wrapped, wrappingKey);
      return true;
    } catch {
      return false;
    }
  }

  async setupEncryption(password: string): Promise<string> {
    const masterKey = await this.crypto.generateMasterKey();
    const salt = this.crypto.generateSalt();
    const recoveryKey = this.crypto.generateRecoveryKey();

    const wrappingKey = await this.crypto.deriveWrappingKey(password, salt);
    const recoveryWrappingKey = await this.crypto.deriveWrappingKeyFromRecovery(recoveryKey);

    const wrappedMasterKey = await this.crypto.wrapKey(masterKey, wrappingKey);
    const recoveryWrappedKey = await this.crypto.wrapKey(masterKey, recoveryWrappingKey);

    const saltHex = bytesToHex(salt);

    this.auth.updateKeyMaterial({ salt: saltHex, wrappedMasterKey, recoveryWrappedKey });

    return recoveryKey;
  }

  async saveEncryptionKeys(): Promise<void> {
    const keyMaterial = this.auth.getKeyMaterial();
    if (!keyMaterial) throw new Error('No key material');
    await firstValueFrom(this.gateway.patchEncryptionKeys(keyMaterial));
    this.auth.setEncryptionVersion(1);
  }

  async migrateEncryption(
    data: Record<string, { id: string; encryptedData: string }[]>,
  ): Promise<void> {
    const keyMaterial = this.auth.getKeyMaterial();
    if (!keyMaterial) throw new Error('No key material');
    await firstValueFrom(this.gateway.migrateEncryption(keyMaterial, data));
    this.auth.setEncryptionVersion(1);
  }

  async updatePasswordWithReWrap(currentPassword: string, newPassword: string): Promise<void> {
    const masterKey = this.crypto.getRewrappableMasterKey();
    if (!masterKey) throw new Error('CryptoStore is locked');

    const { saltHex, wrappedMasterKey } = await this.wrapWithPassword(masterKey, newPassword);

    await firstValueFrom(
      this.gateway.updatePassword({
        currentPassword: await this.auth.presentedSecret(currentPassword),
        newPassword: await this.auth.authKeyFor(newPassword),
        newSalt: saltHex,
        newWrappedMasterKey: wrappedMasterKey,
      }),
    );
    this.auth.markAuthKeyInUse();

    const current = this.auth.getKeyMaterial();
    this.auth.updateKeyMaterial({
      recoveryWrappedKey: current?.recoveryWrappedKey ?? null,
      salt: saltHex,
      wrappedMasterKey,
    });
  }

  private async wrapWithPassword(
    masterKey: CryptoKey,
    password: string,
  ): Promise<{ saltHex: string; wrappedMasterKey: string }> {
    const salt = this.crypto.generateSalt();
    const wrappingKey = await this.crypto.deriveWrappingKey(password, salt);
    return {
      saltHex: bytesToHex(salt),
      wrappedMasterKey: await this.crypto.wrapKey(masterKey, wrappingKey),
    };
  }
}
