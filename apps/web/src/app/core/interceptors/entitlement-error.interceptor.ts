import { inject } from '@angular/core';
import { type HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { Toaster } from '@shared/components/toast/toast';

/**
 * Traduit les refus d'entitlement du back sans jamais éjecter l'utilisateur.
 * - 402 `LIMIT_REACHED` (limite atteinte sur une action délibérée) → toast informatif, pas de redirection.
 * - 403 (feature non incluse) → silencieux : le verrouillage doux (badge) porte l'UX et les
 *   sections pleinement réservées ont leur propre guard de route. Pas de redirection forcée
 *   (sinon un appel avancé en arrière-plan éjecterait un compte gratuit hors de son budget).
 */
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
