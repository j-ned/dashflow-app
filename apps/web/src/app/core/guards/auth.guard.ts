import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthStore } from '@features/auth/domain/auth.store';

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
    return router.createUrlTree(['/auth/encryption-setup']);
  }

  if (auth.needsUnlock()) {
    return router.createUrlTree(['/auth/unlock']);
  }

  return true;
};
