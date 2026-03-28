import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthStore } from '@features/auth/domain/auth.store';

export const guestGuard: CanMatchFn = async () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  if (auth.isLoading()) await auth.checkSession();
  return auth.isAuthenticated() ? router.createUrlTree(['/budget']) : true;
};
