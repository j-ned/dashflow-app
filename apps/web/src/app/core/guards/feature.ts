import { inject } from '@angular/core';
import { type CanMatchFn, Router } from '@angular/router';
import { EntitlementStore } from '@core/entitlements/entitlement.store';
import type { Feature } from '@core/entitlements/entitlement.types';

export function featureGuard(feature: Feature): CanMatchFn {
  return async (_route, segments) => {
    const store = inject(EntitlementStore);
    const router = inject(Router);

    if (!store.isLoaded()) {
      await store.load();
    }

    if (store.can(feature)) {
      return true;
    }

    const returnUrl = '/' + segments.map((s) => s.path).join('/');
    return router.createUrlTree(['/upgrade'], { queryParams: { feature, returnUrl } });
  };
}
