import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CsrfStore {
  private readonly _token = signal<string | null>(null);
  readonly token = this._token.asReadonly();

  setToken(token: string | null): void {
    this._token.set(token);
  }
}
