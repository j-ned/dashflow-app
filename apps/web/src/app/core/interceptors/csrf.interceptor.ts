import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { CsrfStore } from '@core/services/csrf/csrf-store';

const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  if (MUTATIONS.has(req.method)) {
    const token = inject(CsrfStore).token();
    if (token) req = req.clone({ setHeaders: { 'X-CSRF-Token': token } });
  }
  return next(req);
};
