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
import { adminGuard } from './admin';
import { AuthStore } from '@features/auth/domain/auth.store';

type AuthMock = {
  isLoading: ReturnType<typeof vi.fn>;
  isAdmin: ReturnType<typeof vi.fn>;
  checkSession: ReturnType<typeof vi.fn>;
};

const EMPTY_ROUTE: Route = {};
const SEGMENTS: UrlSegment[] = [new UrlSegment('admin', {})];
// v22 : CanMatchFn requiert un 3e arg (currentSnapshot) ; le guard l'ignore.
const MATCH_SNAPSHOT = {} as PartialMatchRouteSnapshot;

describe('adminGuard', () => {
  let authMock: AuthMock;
  let router: Router;

  beforeEach(() => {
    authMock = {
      isLoading: vi.fn().mockReturnValue(false),
      isAdmin: vi.fn().mockReturnValue(false),
      checkSession: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthStore, useValue: authMock }],
    });
    router = TestBed.inject(Router);
  });

  function runGuard() {
    return TestBed.runInInjectionContext(() =>
      adminGuard(EMPTY_ROUTE, SEGMENTS, MATCH_SNAPSHOT),
    ) as Promise<
      boolean | UrlTree
    >;
  }

  it('retourne true pour un admin', async () => {
    authMock.isAdmin.mockReturnValue(true);

    const result = await runGuard();

    expect(result).toBe(true);
  });

  it('redirige un non-admin vers /budget', async () => {
    authMock.isAdmin.mockReturnValue(false);

    const result = await runGuard();

    expect(result).not.toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/budget');
  });

  it('déclenche checkSession() quand la session est en cours de chargement', async () => {
    authMock.isLoading.mockReturnValue(true);
    authMock.isAdmin.mockReturnValue(true);

    await runGuard();

    expect(authMock.checkSession).toHaveBeenCalledTimes(1);
  });

  it('ne déclenche PAS checkSession() quand la session est déjà chargée', async () => {
    authMock.isLoading.mockReturnValue(false);
    authMock.isAdmin.mockReturnValue(true);

    await runGuard();

    expect(authMock.checkSession).not.toHaveBeenCalled();
  });

  it('attend la fin de checkSession() avant d’évaluer isAdmin()', async () => {
    const order: string[] = [];
    authMock.isLoading.mockReturnValue(true);
    authMock.checkSession.mockImplementation(async () => {
      order.push('checkSession');
    });
    authMock.isAdmin.mockImplementation(() => {
      order.push('isAdmin');
      return true;
    });

    await runGuard();

    expect(order).toEqual(['checkSession', 'isAdmin']);
  });
});
