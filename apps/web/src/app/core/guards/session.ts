import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthStore } from '@features/auth/auth.store';

// Exige une session active, sans les redirections d'état de chiffrement de authGuard
// (needsEncryptionSetup/needsUnlock) : /auth/unlock et /auth/encryption-setup EN SONT la cible,
// un authGuard classique y créerait une boucle de redirection.
export const sessionGuard: CanMatchFn = async () => {
  const auth = inject(AuthStore);
  const router = inject(Router);

  if (auth.isLoading()) {
    await auth.checkSession();
  }

  return auth.isAuthenticated() ? true : router.createUrlTree(['/auth/login']);
};
