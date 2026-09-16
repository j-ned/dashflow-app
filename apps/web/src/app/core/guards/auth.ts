import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthStore } from '@features/auth/auth.store';

export const authGuard: CanMatchFn = async () => {
  const auth = inject(AuthStore);
  const router = inject(Router);

  if (auth.isLoading()) {
    await auth.checkSession();
  }

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/auth/login']);
  }

  if (auth.needsEncryptionSetup()) {
    // Premier contact : assistant en 4 écrans (qui saute à la protection si des données existent).
    return router.createUrlTree(['/auth/onboarding']);
  }

  if (auth.needsUnlock()) {
    return router.createUrlTree(['/auth/unlock']);
  }

  return true;
};
