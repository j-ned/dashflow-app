import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthStore, type AuthUser } from './auth.store';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { of } from 'rxjs';

describe('AuthStore — demo account bypass', () => {
  function makeUser(over: Partial<AuthUser> = {}): AuthUser {
    return {
      id: 'u1',
      email: 'x@x',
      displayName: null,
      avatarUrl: null,
      totpEnabled: false,
      hasPassword: true,
      googleLinked: false,
      encryptionVersion: 0,
      hasEncryptionPassphrase: false,
      isDemoAccount: false,
      ...over,
    };
  }

  type AuthStoreInternals = {
    _user: WritableSignal<AuthUser | null>;
    _isAuthenticated: WritableSignal<boolean>;
  };

  let store: AuthStore;
  const internals = () => store as unknown as AuthStoreInternals;
  const mockApi = { get: vi.fn(), post: vi.fn() };
  const mockCrypto = { isUnlocked: () => false, restoreFromSession: vi.fn(), lock: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: checkSession → csrf ok, /auth/me → 401 (unauthenticated)
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/auth/csrf') return of({});
      return of(null);
    });
    mockApi.post.mockReturnValue(of({}));

    TestBed.configureTestingModule({
      providers: [
        AuthStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ApiClient, useValue: mockApi },
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
    mockApi.post.mockReturnValue(of({ token: 'jwt', user: demoUser, keyMaterial: null }));

    await store.demoLogin();

    expect(mockApi.post).toHaveBeenCalledWith('/auth/demo-login', {});
    expect(store.user()).toEqual(demoUser);
    expect(store.isAuthenticated()).toBe(true);
  });

  it('checkSession calls /auth/csrf then /auth/me and sets user when authenticated', async () => {
    const user = makeUser({ email: 'test@example.com' });
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/auth/csrf') return of({});
      if (path === '/auth/me') return of({ ...user, keyMaterial: null });
      return of(null);
    });

    await store.checkSession();

    expect(mockApi.get).toHaveBeenCalledWith('/auth/csrf');
    expect(mockApi.get).toHaveBeenCalledWith('/auth/me');
    expect(store.isAuthenticated()).toBe(true);
    expect(store.user()?.email).toBe('test@example.com');
    expect(store.isLoading()).toBe(false);
  });

  it('checkSession sets unauthenticated when /auth/me throws', async () => {
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/auth/csrf') return of({});
      throw new Error('401');
    });

    await store.checkSession();

    expect(store.isAuthenticated()).toBe(false);
    expect(store.isLoading()).toBe(false);
  });

  it('hydrateFromCookie calls /auth/me and sets user', async () => {
    const user = makeUser({ email: 'oauth@example.com' });
    mockApi.get.mockImplementation((path: string) => {
      if (path === '/auth/me') return of({ ...user, keyMaterial: null });
      return of({});
    });

    await store.hydrateFromCookie();

    expect(mockApi.get).toHaveBeenCalledWith('/auth/me');
    expect(store.isAuthenticated()).toBe(true);
    expect(store.user()?.email).toBe('oauth@example.com');
  });

  it('logout calls crypto.lock, posts to /auth/logout, and clears state', async () => {
    internals()._user.set(makeUser());
    internals()._isAuthenticated.set(true);
    mockApi.post.mockReturnValue(of({}));

    await store.logout();

    expect(mockCrypto.lock).toHaveBeenCalled();
    expect(mockApi.post).toHaveBeenCalledWith('/auth/logout', {});
    expect(store.user()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
  });
});
