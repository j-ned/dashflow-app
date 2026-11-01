import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  UrlSegment,
  type PartialMatchRouteSnapshot,
  type Route,
  type UrlTree,
} from '@angular/router';
import { sessionGuard } from './session';
import { AuthStore } from '@features/auth/auth.store';

type AuthMock = {
  isLoading: ReturnType<typeof vi.fn>;
  isAuthenticated: ReturnType<typeof vi.fn>;
  checkSession: ReturnType<typeof vi.fn>;
};

const EMPTY_ROUTE: Route = {};
const SEGMENTS: UrlSegment[] = [new UrlSegment('unlock', {})];
const MATCH_SNAPSHOT = {} as PartialMatchRouteSnapshot;

describe('sessionGuard', () => {
  let authMock: AuthMock;
  let router: Router;

  beforeEach(() => {
    authMock = {
      isLoading: vi.fn().mockReturnValue(false),
      isAuthenticated: vi.fn().mockReturnValue(false),
      checkSession: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthStore, useValue: authMock }],
    });
    router = TestBed.inject(Router);
  });

  function runGuard() {
    return TestBed.runInInjectionContext(() =>
      sessionGuard(EMPTY_ROUTE, SEGMENTS, MATCH_SNAPSHOT),
    ) as Promise<boolean | UrlTree>;
  }

  it('retourne true pour une session authentifiée', async () => {
    authMock.isAuthenticated.mockReturnValue(true);

    const result = await runGuard();

    expect(result).toBe(true);
  });

  it('redirige un visiteur non authentifié vers /auth/login', async () => {
    authMock.isAuthenticated.mockReturnValue(false);

    const result = await runGuard();

    expect(result).not.toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/auth/login');
  });

  it('déclenche checkSession() quand la session est en cours de chargement', async () => {
    authMock.isLoading.mockReturnValue(true);
    authMock.isAuthenticated.mockReturnValue(true);

    await runGuard();

    expect(authMock.checkSession).toHaveBeenCalledTimes(1);
  });

  it('ne déclenche PAS checkSession() quand la session est déjà chargée', async () => {
    authMock.isLoading.mockReturnValue(false);
    authMock.isAuthenticated.mockReturnValue(true);

    await runGuard();

    expect(authMock.checkSession).not.toHaveBeenCalled();
  });
});
