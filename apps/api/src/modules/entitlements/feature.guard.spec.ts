import { describe, it, expect } from 'vitest';
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureGuard } from './feature.guard';
import type { EntitlementService } from './entitlement.service';
import type { Feature } from './plan-catalog';

function ctx(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function reflectorReturning(features: Feature[] | undefined): Reflector {
  return { getAllAndOverride: () => features } as unknown as Reflector;
}

function entitlementsWith(features: Feature[]): EntitlementService {
  return {
    getForUser: async () => ({ planKey: 'family', features, limits: { bankAccounts: null, members: null, storageBytes: 0 } }),
  } as unknown as EntitlementService;
}

describe('FeatureGuard', () => {
  it('laisse passer si aucune feature requise', async () => {
    const guard = new FeatureGuard(reflectorReturning(undefined), entitlementsWith([]));
    await expect(guard.canActivate(ctx({ id: 'u1' }))).resolves.toBe(true);
  });

  it('laisse passer si le plan possède la feature', async () => {
    const guard = new FeatureGuard(reflectorReturning(['medical.access']), entitlementsWith(['medical.access']));
    await expect(guard.canActivate(ctx({ id: 'u1' }))).resolves.toBe(true);
  });

  it('refuse (403) si la feature manque', async () => {
    const guard = new FeatureGuard(reflectorReturning(['medical.access']), entitlementsWith(['budget.core']));
    await expect(guard.canActivate(ctx({ id: 'u1' }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuse (401) si pas d’utilisateur en contexte', async () => {
    const guard = new FeatureGuard(reflectorReturning(['medical.access']), entitlementsWith(['medical.access']));
    await expect(guard.canActivate(ctx(undefined))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
