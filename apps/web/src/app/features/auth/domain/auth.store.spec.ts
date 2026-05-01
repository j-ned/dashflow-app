import { describe, it, expect, beforeEach, vi } from 'vitest';
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

  let store: AuthStore;
  const mockApi = { getToken: () => null, setToken: vi.fn(), clearToken: vi.fn(), get: vi.fn(), post: vi.fn() };
  const mockCrypto = { isUnlocked: () => false, restoreFromSession: vi.fn() };

  beforeEach(() => {
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
    (store as any)._user.set(makeUser({ encryptionVersion: 0, isDemoAccount: true }));
    (store as any)._isAuthenticated.set(true);
    expect(store.needsEncryptionSetup()).toBe(false);
  });

  it('needsEncryptionSetup is TRUE for normal user with version 0', () => {
    (store as any)._user.set(makeUser({ encryptionVersion: 0, isDemoAccount: false }));
    (store as any)._isAuthenticated.set(true);
    expect(store.needsEncryptionSetup()).toBe(true);
  });

  it('needsUnlock is FALSE for demo account with version 1 and locked crypto', () => {
    (store as any)._user.set(makeUser({ encryptionVersion: 1, isDemoAccount: true }));
    (store as any)._isAuthenticated.set(true);
    expect(store.needsUnlock()).toBe(false);
  });

  it('needsUnlock is TRUE for normal user with version 1 and locked crypto', () => {
    (store as any)._user.set(makeUser({ encryptionVersion: 1, isDemoAccount: false }));
    (store as any)._isAuthenticated.set(true);
    expect(store.needsUnlock()).toBe(true);
  });

  it('demoLogin posts to /auth/demo-login and stores token + user', async () => {
    const demoUser = makeUser({ isDemoAccount: true, email: 'demo@dashflow.app' });
    mockApi.post.mockReturnValue(of({ token: 'jwt', user: demoUser, keyMaterial: null }));

    await store.demoLogin();

    expect(mockApi.post).toHaveBeenCalledWith('/auth/demo-login', {});
    expect(mockApi.setToken).toHaveBeenCalledWith('jwt');
    expect(store.user()).toEqual(demoUser);
    expect(store.isAuthenticated()).toBe(true);
  });
});
