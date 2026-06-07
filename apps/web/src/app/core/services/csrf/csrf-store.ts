import { Injectable, signal } from '@angular/core';

// Cross-origin: the front cannot read the API-subdomain cookie, so the token is delivered in the GET /auth/csrf response body and echoed in X-CSRF-Token — the double-submit invariant holds because only a CORS-allowed origin can read it.
@Injectable({ providedIn: 'root' })
export class CsrfStore {
  private readonly _token = signal<string | null>(null);
  readonly token = this._token.asReadonly();

  setToken(token: string | null): void {
    this._token.set(token);
  }
}
