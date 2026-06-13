import { inject } from '@angular/core';
import { type HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { Toaster } from '@shared/components/toast/toast';

export const entitlementErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const toaster = inject(Toaster);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const code = (err.error as { code?: string } | null)?.code;

      if (err.status === 402 && code === 'LIMIT_REACHED') {
        const limit = (err.error as { limit: string }).limit;
        toaster.error('entitlement.limit.' + limit);
      }

      return throwError(() => err);
    }),
  );
};
