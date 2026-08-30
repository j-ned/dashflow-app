import { inject, Injectable } from '@angular/core';
import { CryptoStore, bytesToHex } from '@core/services/crypto/crypto.store';
import { AuthStore } from './auth.store';
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

    const salt = this.crypto.generateSalt();
    const wrappingKey = await this.crypto.deriveWrappingKey(password, salt);
    const wrappedMasterKey = await this.crypto.wrapKey(masterKey, wrappingKey);
    const saltHex = bytesToHex(salt);
    const recoveryWrappedKey = keyMaterial.recoveryWrappedKey;

    await firstValueFrom(
      this.gateway.patchEncryptionKeys({ salt: saltHex, wrappedMasterKey, recoveryWrappedKey }),
    );

    this.auth.updateKeyMaterial({ salt: saltHex, wrappedMasterKey, recoveryWrappedKey });
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

    const salt = this.crypto.generateSalt();
    const wrappingKey = await this.crypto.deriveWrappingKey(newPassword, salt);
    const wrappedMasterKey = await this.crypto.wrapKey(masterKey, wrappingKey);
    const saltHex = bytesToHex(salt);

    await firstValueFrom(
      this.gateway.updatePassword({
        currentPassword,
        newPassword,
        newSalt: saltHex,
        newWrappedMasterKey: wrappedMasterKey,
      }),
    );

    const current = this.auth.getKeyMaterial();
    this.auth.updateKeyMaterial({
      recoveryWrappedKey: current?.recoveryWrappedKey ?? null,
      salt: saltHex,
      wrappedMasterKey,
    });
  }
}
