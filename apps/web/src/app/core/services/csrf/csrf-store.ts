import { Injectable, signal } from '@angular/core';

/**
 * Holds the CSRF token in memory (delivered in the body of `GET /auth/csrf`).
 *
 * Cross-origin rationale: the front (app domain) cannot read the `dashflow_csrf`
 * cookie set on the API subdomain via `document.cookie`. So instead of the classic
 * read-cookie/echo-header double-submit, we keep the token returned in the response
 * body and echo it in the `X-CSRF-Token` header. The httpOnly cookie is still sent
 * automatically to the API and the guard compares header vs cookie — the double-submit
 * invariant holds because the token is only readable through a CORS-protected GET.
 */
@Injectable({ providedIn: 'root' })
export class CsrfStore {
  private readonly _token = signal<string | null>(null);
  readonly token = this._token.asReadonly();

  setToken(token: string | null): void {
    this._token.set(token);
  }
}
