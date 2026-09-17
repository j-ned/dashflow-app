import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthEncryptionStore } from './auth-encryption.store';
import { AuthStore } from './auth.store';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { HttpAuthGateway } from './infra/http-auth.gateway';
import { KeyMaterial } from './domain/models/key-material.model';
import { deriveAuthKey } from '@core/services/crypto/auth-key';

describe('AuthEncryptionStore', () => {
  let store: AuthEncryptionStore;
  const mockAuth = {
    getKeyMaterial: vi.fn<() => KeyMaterial | null>(),
    updateKeyMaterial: vi.fn(),
    setEncryptionVersion: vi.fn(),
    // Preuve du mot de passe courant / clé d'authentification d'un nouveau mot de passe.
    presentedSecret: vi.fn((password: string) => Promise.resolve(`proof(${password})`)),
    authKeyFor: vi.fn((password: string) => Promise.resolve(`key(${password})`)),
    markAuthKeyInUse: vi.fn(),
  };
  const mockCrypto = {
    unlock: vi.fn(),
    unlockWithRecovery: vi.fn(),
    getRewrappableMasterKey: vi.fn(),
    generateSalt: vi.fn(),
    generateRecoveryKey: vi.fn(),
    deriveWrappingKey: vi.fn(),
    deriveWrappingKeyFromRecovery: vi.fn(),
    wrapKey: vi.fn(),
    generateMasterKey: vi.fn(),
    lock: vi.fn(),
  };
  const mockGateway = {
    patchEncryptionKeys: vi.fn(),
    migrateEncryption: vi.fn(),
    updatePassword: vi.fn(),
    resetPasswordWithRecovery: vi.fn(),
  };

  const KEY_MATERIAL: KeyMaterial = {
    salt: 'aabbcc',
    wrappedMasterKey: 'wrapped-master',
    recoveryWrappedKey: 'wrapped-recovery',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.getKeyMaterial.mockReturnValue(KEY_MATERIAL);
    mockCrypto.generateSalt.mockReturnValue(new Uint8Array([1, 2, 3]));
    mockCrypto.deriveWrappingKey.mockResolvedValue({} as CryptoKey);
    mockCrypto.deriveWrappingKeyFromRecovery.mockResolvedValue({} as CryptoKey);
    mockCrypto.wrapKey.mockResolvedValue('new-wrapped');
    mockCrypto.getRewrappableMasterKey.mockReturnValue({} as CryptoKey);
    mockGateway.patchEncryptionKeys.mockReturnValue(of(undefined));
    mockGateway.migrateEncryption.mockReturnValue(of(undefined));
    mockGateway.updatePassword.mockReturnValue(of(undefined));
    mockGateway.resetPasswordWithRecovery.mockReturnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        AuthEncryptionStore,
        { provide: AuthStore, useValue: mockAuth },
        { provide: CryptoStore, useValue: mockCrypto },
        { provide: HttpAuthGateway, useValue: mockGateway },
      ],
    });
    store = TestBed.inject(AuthEncryptionStore);
  });

  describe('unlockWithPassword', () => {
    it('given un keyMaterial disponible, when unlockWithPassword, then crypto.unlock reçoit le sel et la clé enveloppée', async () => {
      await store.unlockWithPassword('secret12345');

      expect(mockCrypto.unlock).toHaveBeenCalledWith('secret12345', 'aabbcc', 'wrapped-master');
    });

    it('given aucun keyMaterial, when unlockWithPassword, then lève une erreur sans appeler crypto', async () => {
      mockAuth.getKeyMaterial.mockReturnValue(null);

      await expect(store.unlockWithPassword('x')).rejects.toThrow('No key material available');
      expect(mockCrypto.unlock).not.toHaveBeenCalled();
    });
  });

  describe('unlockWithRecovery', () => {
    it('given une recoveryWrappedKey disponible, when unlockWithRecovery, then crypto.unlockWithRecovery est appelé', async () => {
      await store.unlockWithRecovery('a'.repeat(64));

      expect(mockCrypto.unlockWithRecovery).toHaveBeenCalledWith(
        'a'.repeat(64),
        'wrapped-recovery',
      );
    });

    it('given pas de recoveryWrappedKey, when unlockWithRecovery, then lève une erreur', async () => {
      mockAuth.getKeyMaterial.mockReturnValue({ ...KEY_MATERIAL, recoveryWrappedKey: null });

      await expect(store.unlockWithRecovery('x')).rejects.toThrow('No recovery key material');
    });
  });

  describe('repairWithRecovery', () => {
    it('given une récupération réussie, when repairWithRecovery, then PATCH encryption-keys avec le mot de passe courant (réauthentification) puis met à jour le keyMaterial local', async () => {
      await store.repairWithRecovery('a'.repeat(64), 'nouveau-mdp-1234');

      expect(mockCrypto.unlockWithRecovery).toHaveBeenCalledWith(
        'a'.repeat(64),
        'wrapped-recovery',
      );
      expect(mockGateway.patchEncryptionKeys).toHaveBeenCalledWith(
        expect.objectContaining({
          wrappedMasterKey: 'new-wrapped',
          recoveryWrappedKey: 'wrapped-recovery',
        }),
        'proof(nouveau-mdp-1234)',
      );
      expect(mockAuth.updateKeyMaterial).toHaveBeenCalledWith(
        expect.objectContaining({ wrappedMasterKey: 'new-wrapped' }),
      );
    });

    it('given le déverrouillage par récupération échoue, when repairWithRecovery, then ne PATCH pas et ne met pas à jour le keyMaterial', async () => {
      mockCrypto.getRewrappableMasterKey.mockReturnValue(null);

      await expect(store.repairWithRecovery('a'.repeat(64), 'x')).rejects.toThrow(
        'Failed to unlock with recovery',
      );
      expect(mockGateway.patchEncryptionKeys).not.toHaveBeenCalled();
      expect(mockAuth.updateKeyMaterial).not.toHaveBeenCalled();
    });
  });

  describe('resetPasswordWithRecovery (hors session)', () => {
    const RESET = {
      email: 'user@dash.flow',
      code: '123456',
      newPassword: 'nouveau-mdp-1234',
      recoveryHex: 'a'.repeat(64),
      recoveryWrappedKey: 'rwk-from-409',
    };

    it('given une clé de récupération valide, when resetPasswordWithRecovery, then envoie code, mot de passe et clé ré-emballée en une requête, puis reverrouille', async () => {
      await store.resetPasswordWithRecovery(RESET);

      expect(mockCrypto.unlockWithRecovery).toHaveBeenCalledWith(RESET.recoveryHex, 'rwk-from-409');
      expect(mockGateway.resetPasswordWithRecovery).toHaveBeenCalledWith({
        email: RESET.email,
        code: RESET.code,
        newPassword: await deriveAuthKey(RESET.newPassword, RESET.email),
        newSalt: '010203',
        newWrappedMasterKey: 'new-wrapped',
      });
      expect(mockCrypto.lock).toHaveBeenCalledTimes(1);
      expect(mockAuth.updateKeyMaterial).not.toHaveBeenCalled();
    });

    it('given une clé de récupération invalide, when resetPasswordWithRecovery, then aucune requête', async () => {
      mockCrypto.unlockWithRecovery.mockRejectedValueOnce(new Error('bad key'));

      await expect(store.resetPasswordWithRecovery(RESET)).rejects.toThrow('bad key');
      expect(mockGateway.resetPasswordWithRecovery).not.toHaveBeenCalled();
    });

    it('given le serveur refuse (code expiré), when resetPasswordWithRecovery, then propage et reverrouille quand même', async () => {
      mockGateway.resetPasswordWithRecovery.mockReturnValue(
        throwError(() => ({ status: 400, message: 'Code invalide ou expiré' })),
      );

      await expect(store.resetPasswordWithRecovery(RESET)).rejects.toMatchObject({ status: 400 });
      expect(mockCrypto.lock).toHaveBeenCalledTimes(1);
    });
  });

  describe('resetPasswordWithWipe', () => {
    it('given une clé de récupération perdue, when resetPasswordWithWipe, then demande l’effacement sans aucune opération crypto', async () => {
      await store.resetPasswordWithWipe('user@dash.flow', '123456', 'nouveau-mdp-1234');

      expect(mockGateway.resetPasswordWithRecovery).toHaveBeenCalledWith({
        email: 'user@dash.flow',
        code: '123456',
        newPassword: await deriveAuthKey('nouveau-mdp-1234', 'user@dash.flow'),
        wipe: true,
      });
      expect(mockCrypto.unlockWithRecovery).not.toHaveBeenCalled();
    });
  });

  describe('setupEncryption', () => {
    it('given un mot de passe, when setupEncryption, then génère et enveloppe une clé maîtresse, mémorise le keyMaterial et retourne la clé de récupération', async () => {
      mockCrypto.generateMasterKey.mockResolvedValue({} as CryptoKey);
      mockCrypto.generateRecoveryKey.mockReturnValue('recovery-plain-key');

      const recoveryKey = await store.setupEncryption('mot-de-passe-123');

      expect(recoveryKey).toBe('recovery-plain-key');
      expect(mockCrypto.wrapKey).toHaveBeenCalledTimes(2); // password wrap + recovery wrap
      expect(mockAuth.updateKeyMaterial).toHaveBeenCalledWith(
        expect.objectContaining({
          wrappedMasterKey: 'new-wrapped',
          recoveryWrappedKey: 'new-wrapped',
        }),
      );
    });
  });

  describe('saveEncryptionKeys', () => {
    it('given un keyMaterial présent, when saveEncryptionKeys, then PATCH puis passe encryptionVersion à 1', async () => {
      await store.saveEncryptionKeys();

      expect(mockGateway.patchEncryptionKeys).toHaveBeenCalledWith(KEY_MATERIAL);
      expect(mockAuth.setEncryptionVersion).toHaveBeenCalledWith(1);
    });

    it('given aucun keyMaterial, when saveEncryptionKeys, then lève une erreur sans PATCH', async () => {
      mockAuth.getKeyMaterial.mockReturnValue(null);

      await expect(store.saveEncryptionKeys()).rejects.toThrow('No key material');
      expect(mockGateway.patchEncryptionKeys).not.toHaveBeenCalled();
    });
  });

  describe('migrateEncryption', () => {
    it('given des données chiffrées, when migrateEncryption, then POST migrate-encryption puis passe encryptionVersion à 1', async () => {
      const data = { patients: [{ id: '1', encryptedData: 'x' }] };

      await store.migrateEncryption(data);

      expect(mockGateway.migrateEncryption).toHaveBeenCalledWith(KEY_MATERIAL, data);
      expect(mockAuth.setEncryptionVersion).toHaveBeenCalledWith(1);
    });
  });

  describe('updatePasswordWithReWrap', () => {
    it('given crypto déverrouillé, when updatePasswordWithReWrap, then PATCH le mot de passe avec le nouveau sel et met à jour le keyMaterial', async () => {
      await store.updatePasswordWithReWrap('ancien-mdp-123', 'nouveau-mdp-456');

      expect(mockGateway.updatePassword).toHaveBeenCalledWith(
        expect.objectContaining({
          currentPassword: 'proof(ancien-mdp-123)',
          newPassword: 'key(nouveau-mdp-456)',
          newWrappedMasterKey: 'new-wrapped',
        }),
      );
      expect(mockAuth.updateKeyMaterial).toHaveBeenCalledWith(
        expect.objectContaining({ wrappedMasterKey: 'new-wrapped' }),
      );
      expect(mockAuth.markAuthKeyInUse).toHaveBeenCalledTimes(1);
    });

    it('given crypto verrouillé, when updatePasswordWithReWrap, then lève une erreur sans PATCH', async () => {
      mockCrypto.getRewrappableMasterKey.mockReturnValue(null);

      await expect(store.updatePasswordWithReWrap('a', 'b')).rejects.toThrow(
        'CryptoStore is locked',
      );
      expect(mockGateway.updatePassword).not.toHaveBeenCalled();
    });
  });
});
