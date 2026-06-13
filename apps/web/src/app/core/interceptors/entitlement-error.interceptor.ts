import { inject } from '@angular/core';
import { type HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { Toaster } from '@shared/components/toast/toast';

export const entitlementErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const toaster = inject(Toaster);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const code = (err.error as { code?: string } | null)?.code;

      if (err.status === 402 && code === 'LIMIT_REACHED') {
        const limit = (err.error as { limit: string }).limit;
        toaster.error('entitlement.limit.' + limit);
        router.navigate(['/upgrade'], { queryParams: { reason: 'limit', limit } });
      } else if (err.status === 403) {
        toaster.info('entitlement.feature.locked');
        router.navigate(['/upgrade']);
      }

      return throwError(() => err);
    }),
  );
};
