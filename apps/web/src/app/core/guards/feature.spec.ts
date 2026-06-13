import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlSegment, type Route, type UrlTree } from '@angular/router';
import { featureGuard } from './feature';
import { EntitlementStore } from '@core/entitlements/entitlement.store';
import type { Feature } from '@core/entitlements/entitlement.types';

type StoreMock = {
  isLoaded: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
  can: ReturnType<typeof vi.fn>;
};

function segmentsOf(path: string): UrlSegment[] {
  return path
    .split('/')
    .filter(Boolean)
    .map((p) => new UrlSegment(p, {}));
}

const EMPTY_ROUTE: Route = {};

describe('featureGuard', () => {
  let storeMock: StoreMock;
  let router: Router;

  beforeEach(() => {
    storeMock = {
      isLoaded: vi.fn().mockReturnValue(true),
      load: vi.fn().mockResolvedValue(undefined),
      can: vi.fn().mockReturnValue(false),
    };

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: EntitlementStore, useValue: storeMock }],
    });
    router = TestBed.inject(Router);
  });

  function runGuard(feature: Feature, segments: UrlSegment[]) {
    return TestBed.runInInjectionContext(() =>
      featureGuard(feature)(EMPTY_ROUTE, segments),
    ) as Promise<boolean | UrlTree>;
  }

  it('déclenche load() si l’entitlement n’est pas encore chargé', async () => {
    storeMock.isLoaded.mockReturnValue(false);
    storeMock.can.mockReturnValue(true);

    await runGuard('medical.access', segmentsOf('/medical'));

    expect(storeMock.load).toHaveBeenCalledTimes(1);
  });

  it('ne déclenche PAS load() si déjà chargé (idempotence côté guard)', async () => {
    storeMock.isLoaded.mockReturnValue(true);
    storeMock.can.mockReturnValue(true);

    await runGuard('medical.access', segmentsOf('/medical'));

    expect(storeMock.load).not.toHaveBeenCalled();
  });

  it('retourne true quand la feature est accordée', async () => {
    storeMock.can.mockReturnValue(true);

    const result = await runGuard('medical.access', segmentsOf('/medical'));

    expect(result).toBe(true);
  });

  it('redirige vers /upgrade avec feature + returnUrl quand la feature est refusée', async () => {
    storeMock.can.mockReturnValue(false);

    const result = await runGuard('medical.access', segmentsOf('/medical/appointments'));

    expect(result).not.toBe(true);
    const tree = result as UrlTree;
    expect(router.serializeUrl(tree)).toContain('/upgrade');
    expect(tree.queryParams['feature']).toBe('medical.access');
    expect(tree.queryParams['returnUrl']).toBe('/medical/appointments');
  });

  it('reconstruit le returnUrl complet depuis les segments demandés', async () => {
    storeMock.can.mockReturnValue(false);

    const result = (await runGuard('budget.advanced', segmentsOf('/budget/loans'))) as UrlTree;

    expect(result.queryParams['returnUrl']).toBe('/budget/loans');
  });

  it('le returnUrl produit est toujours un chemin interne (commence par /, pas de //)', async () => {
    storeMock.can.mockReturnValue(false);

    const result = (await runGuard('medical.access', segmentsOf('/medical'))) as UrlTree;
    const returnUrl = result.queryParams['returnUrl'] as string;

    expect(returnUrl.startsWith('/')).toBe(true);
    expect(returnUrl.startsWith('//')).toBe(false);
  });

  it('attend la fin de load() avant d’évaluer can() (course amorçage/guard)', async () => {
    const order: string[] = [];
    storeMock.isLoaded.mockReturnValue(false);
    storeMock.load.mockImplementation(async () => {
      order.push('load');
    });
    storeMock.can.mockImplementation(() => {
      order.push('can');
      return true;
    });

    await runGuard('medical.access', segmentsOf('/medical'));

    expect(order).toEqual(['load', 'can']);
  });
});
