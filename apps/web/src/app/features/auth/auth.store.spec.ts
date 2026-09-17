import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthStore } from './auth.store';
import { AuthUser } from './domain/models/auth-user.model';
import { HttpAuthGateway } from './infra/http-auth.gateway';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { deriveAuthKey } from '@core/services/crypto/auth-key';
import { of, throwError } from 'rxjs';

describe('AuthStore : demo account bypass', () => {
  function makeUser(over: Partial<AuthUser> = {}): AuthUser {
    return {
      id: 'u1',
      email: 'x@x',
      displayName: null,
      avatarUrl: null,
      totpEnabled: false,
      hasPassword: true,
      authVersion: 1,
      googleLinked: false,
      encryptionVersion: 0,
      hasEncryptionPassphrase: false,
      isDemoAccount: false,
      role: 'user',
      ...over,
    };
  }

  type AuthStoreInternals = {
    _user: WritableSignal<AuthUser | null>;
    _isAuthenticated: WritableSignal<boolean>;
  };

  let store: AuthStore;
  const internals = () => store as unknown as AuthStoreInternals;
  const mockGateway = {
    getCsrfToken: vi.fn(),
    getMe: vi.fn(),
    demoLogin: vi.fn(),
    logout: vi.fn(),
    setPassword: vi.fn(),
    prelogin: vi.fn(),
    login: vi.fn(),
    upgradeAuth: vi.fn(),
    register: vi.fn(),
    disable2FA: vi.fn(),
  };
  const mockCrypto = {
    isUnlocked: () => false,
    restoreFromStorage: vi.fn(),
    lock: vi.fn(),
    getRewrappableMasterKey: vi.fn().mockReturnValue(null),
    generateSalt: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
    deriveWrappingKey: vi.fn().mockResolvedValue({} as CryptoKey),
    wrapKey: vi.fn().mockResolvedValue('wrapped'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: checkSession → csrf ok, /auth/me → 401 (unauthenticated)
    mockGateway.getCsrfToken.mockReturnValue(of({}));
    mockGateway.getMe.mockReturnValue(of(null));
    mockGateway.logout.mockReturnValue(of({}));
    mockGateway.setPassword.mockReturnValue(of({}));
    mockCrypto.getRewrappableMasterKey.mockReturnValue(null);

    TestBed.configureTestingModule({
      providers: [
        AuthStore,
        { provide: HttpAuthGateway, useValue: mockGateway },
        { provide: CryptoStore, useValue: mockCrypto },
      ],
    });
    store = TestBed.inject(AuthStore);
  });

  it('needsEncryptionSetup is FALSE for demo account with version 0', () => {
    internals()._user.set(makeUser({ encryptionVersion: 0, isDemoAccount: true }));
    internals()._isAuthenticated.set(true);
    expect(store.needsEncryptionSetup()).toBe(false);
  });

  it('needsEncryptionSetup is TRUE for normal user with version 0', () => {
    internals()._user.set(makeUser({ encryptionVersion: 0, isDemoAccount: false }));
    internals()._isAuthenticated.set(true);
    expect(store.needsEncryptionSetup()).toBe(true);
  });

  it('needsUnlock is FALSE for demo account with version 1 and locked crypto', () => {
    internals()._user.set(makeUser({ encryptionVersion: 1, isDemoAccount: true }));
    internals()._isAuthenticated.set(true);
    expect(store.needsUnlock()).toBe(false);
  });

  it('needsUnlock is TRUE for normal user with version 1 and locked crypto', () => {
    internals()._user.set(makeUser({ encryptionVersion: 1, isDemoAccount: false }));
    internals()._isAuthenticated.set(true);
    expect(store.needsUnlock()).toBe(true);
  });

  it('demoLogin posts to /auth/demo-login and stores user', async () => {
    const demoUser = makeUser({ isDemoAccount: true, email: 'demo@dashflow.app' });
    mockGateway.demoLogin.mockReturnValue(of({ token: 'jwt', user: demoUser, keyMaterial: null }));

    await store.demoLogin();

    expect(mockGateway.demoLogin).toHaveBeenCalled();
    expect(store.user()).toEqual(demoUser);
    expect(store.isAuthenticated()).toBe(true);
  });

  it('checkSession calls getCsrfToken then getMe and sets user when authenticated', async () => {
    const user = makeUser({ email: 'test@example.com' });
    mockGateway.getMe.mockReturnValue(of({ ...user, keyMaterial: null }));

    await store.checkSession();

    expect(mockGateway.getCsrfToken).toHaveBeenCalled();
    expect(mockGateway.getMe).toHaveBeenCalled();
    expect(store.isAuthenticated()).toBe(true);
    expect(store.user()?.email).toBe('test@example.com');
    expect(store.isLoading()).toBe(false);
  });

  it('given deux appels concurrents (constructeur + guard), when checkSession, then une seule requête réseau est faite', async () => {
    // Le constructeur (TestBed.inject) a déjà déclenché son propre checkSession : on le laisse
    // se terminer pour repartir d'un état propre avant d'isoler les deux appels concurrents testés ici.
    await store.checkSession();
    mockGateway.getCsrfToken.mockClear();
    mockGateway.getMe.mockClear();
    const user = makeUser({ email: 'test@example.com' });
    mockGateway.getMe.mockReturnValue(of({ ...user, keyMaterial: null }));

    const first = store.checkSession();
    const second = store.checkSession();
    await Promise.all([first, second]);

    expect(mockGateway.getCsrfToken).toHaveBeenCalledTimes(1);
    expect(mockGateway.getMe).toHaveBeenCalledTimes(1);
    expect(store.isAuthenticated()).toBe(true);
  });

  it('checkSession sets unauthenticated when getMe throws', async () => {
    mockGateway.getMe.mockImplementation(() => {
      throw new Error('401');
    });

    await store.checkSession();

    expect(store.isAuthenticated()).toBe(false);
    expect(store.isLoading()).toBe(false);
  });

  it('given getMe renvoie un payload avec un role inconnu (F019), when checkSession, then rejette et reste non-authentifié', async () => {
    mockGateway.getMe.mockReturnValue(of({ ...makeUser(), role: 'superadmin', keyMaterial: null }));

    await store.checkSession();

    expect(store.isAuthenticated()).toBe(false);
    expect(store.user()).toBeNull();
  });

  it('hydrateFromCookie calls getMe and sets user', async () => {
    const user = makeUser({ email: 'oauth@example.com' });
    mockGateway.getMe.mockReturnValue(of({ ...user, keyMaterial: null }));

    await store.hydrateFromCookie();

    expect(mockGateway.getMe).toHaveBeenCalled();
    expect(store.isAuthenticated()).toBe(true);
    expect(store.user()?.email).toBe('oauth@example.com');
  });

  it('given getMe renvoie un payload invalide (F019), when hydrateFromCookie, then lève et ne modifie pas isAuthenticated', async () => {
    mockGateway.getMe.mockReturnValue(
      of({ ...makeUser(), encryptionVersion: 'oops', keyMaterial: null }),
    );

    await expect(store.hydrateFromCookie()).rejects.toBeTruthy();

    expect(store.isAuthenticated()).toBe(false);
  });

  it('isAdmin is TRUE when the user role is admin', () => {
    internals()._user.set(makeUser({ role: 'admin' }));
    internals()._isAuthenticated.set(true);
    expect(store.isAdmin()).toBe(true);
  });

  it('isAdmin is FALSE for a normal user role', () => {
    internals()._user.set(makeUser({ role: 'user' }));
    internals()._isAuthenticated.set(true);
    expect(store.isAdmin()).toBe(false);
  });

  it('isAdmin is FALSE when no user is loaded', () => {
    internals()._user.set(null);
    expect(store.isAdmin()).toBe(false);
  });

  it('logout calls crypto.lock, calls gateway.logout, and clears state', async () => {
    internals()._user.set(makeUser());
    internals()._isAuthenticated.set(true);

    await store.logout();

    expect(mockCrypto.lock).toHaveBeenCalled();
    expect(mockGateway.logout).toHaveBeenCalled();
    expect(store.user()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
  });

  describe('setPassword', () => {
    it('given une clé rewrappable disponible, when setPassword, then envoie les champs de rewrap', async () => {
      mockCrypto.getRewrappableMasterKey.mockReturnValue({} as CryptoKey);
      internals()._user.set(makeUser({ encryptionVersion: 1 }));

      await store.setPassword('nouveau-mdp-123456');

      expect(mockGateway.setPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          newPassword: await deriveAuthKey('nouveau-mdp-123456', 'x@x'),
          newWrappedMasterKey: 'wrapped',
        }),
      );
    });

    it('given encryptionVersion 1 sans clé rewrappable (E2EE verrouillée), when setPassword, then lève E2EE_LOCKED sans appeler la gateway', async () => {
      mockCrypto.getRewrappableMasterKey.mockReturnValue(null);
      internals()._user.set(makeUser({ encryptionVersion: 1 }));

      await expect(store.setPassword('nouveau-mdp-123456')).rejects.toThrow('E2EE_LOCKED');
      expect(mockGateway.setPassword).not.toHaveBeenCalled();
    });

    it('given encryptionVersion 0 (pas de E2EE), when setPassword, then envoie la requête sans champs de rewrap', async () => {
      mockCrypto.getRewrappableMasterKey.mockReturnValue(null);
      internals()._user.set(makeUser({ encryptionVersion: 0 }));

      await store.setPassword('nouveau-mdp-123456');

      expect(mockGateway.setPassword).toHaveBeenCalledWith({
        newPassword: await deriveAuthKey('nouveau-mdp-123456', 'x@x'),
      });
    });
  });

  describe('le mot de passe ne part jamais au serveur', () => {
    const EMAIL = 'julie@dash.flow';
    const PASSWORD = 'correct horse battery';

    it('register : envoie la clé d’authentification dérivée, pas le mot de passe', async () => {
      mockGateway.register.mockReturnValue(of(undefined));

      await store.register(EMAIL, PASSWORD, 'Julie');

      expect(mockGateway.register).toHaveBeenCalledWith(
        EMAIL,
        await deriveAuthKey(PASSWORD, EMAIL),
        'Julie',
      );
    });

    it('login, compte migré (prelogin 1) : seule la clé part, aucune bascule', async () => {
      mockGateway.prelogin.mockReturnValue(of({ authVersion: 1 }));
      mockGateway.login.mockReturnValue(of({ user: makeUser({ email: EMAIL }), csrfToken: 't' }));

      expect(await store.login(EMAIL, PASSWORD)).toBe('authenticated');

      expect(mockGateway.login).toHaveBeenCalledWith(
        EMAIL,
        await deriveAuthKey(PASSWORD, EMAIL),
        undefined,
      );
      expect(JSON.stringify(mockGateway.login.mock.calls)).not.toContain(PASSWORD);
      expect(mockGateway.upgradeAuth).not.toHaveBeenCalled();
    });

    it('login, compte d’avant la dérivation (prelogin 0) : mot de passe une dernière fois, puis bascule sur la clé', async () => {
      mockGateway.prelogin.mockReturnValue(of({ authVersion: 0 }));
      mockGateway.login.mockReturnValue(
        of({ user: makeUser({ email: EMAIL, authVersion: 0 }), csrfToken: 't' }),
      );
      mockGateway.upgradeAuth.mockReturnValue(of(makeUser({ email: EMAIL, authVersion: 1 })));

      await store.login(EMAIL, PASSWORD);

      expect(mockGateway.login).toHaveBeenCalledWith(EMAIL, PASSWORD, undefined);
      expect(mockGateway.upgradeAuth).toHaveBeenCalledWith(
        PASSWORD,
        await deriveAuthKey(PASSWORD, EMAIL),
      );
      expect(store.user()?.authVersion).toBe(1);
    });

    it('login, bascule en échec : la session reste ouverte en version 0 et prouve encore par le mot de passe', async () => {
      mockGateway.prelogin.mockReturnValue(of({ authVersion: 0 }));
      mockGateway.login.mockReturnValue(
        of({ user: makeUser({ email: EMAIL, authVersion: 0 }), csrfToken: 't' }),
      );
      mockGateway.upgradeAuth.mockReturnValue(throwError(() => new Error('réseau')));
      mockGateway.disable2FA.mockReturnValue(of(undefined));

      expect(await store.login(EMAIL, PASSWORD)).toBe('authenticated');
      await store.disable2FA(PASSWORD);

      expect(store.user()?.authVersion).toBe(0);
      expect(mockGateway.disable2FA).toHaveBeenCalledWith(PASSWORD);
    });

    it('login avec 2FA requise : pas de session, donc pas de bascule', async () => {
      mockGateway.prelogin.mockReturnValue(of({ authVersion: 0 }));
      mockGateway.login.mockReturnValue(of({ mfaRequired: true }));

      expect(await store.login(EMAIL, PASSWORD)).toBe('mfa_required');
      expect(mockGateway.upgradeAuth).not.toHaveBeenCalled();
    });

    it('preuve du mot de passe en session migrée (désactivation 2FA) : la clé, pas le mot de passe', async () => {
      internals()._user.set(makeUser({ email: EMAIL, totpEnabled: true }));
      mockGateway.disable2FA.mockReturnValue(of(undefined));

      await store.disable2FA(PASSWORD);

      expect(mockGateway.disable2FA).toHaveBeenCalledWith(await deriveAuthKey(PASSWORD, EMAIL));
    });
  });
});
