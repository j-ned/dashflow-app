import { HttpInterceptorFn } from '@angular/common/http';

const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  if (MUTATIONS.has(req.method)) {
    const token = readCookie('dashflow_csrf');
    if (token) req = req.clone({ setHeaders: { 'X-CSRF-Token': token } });
  }
  return next(req);
};
