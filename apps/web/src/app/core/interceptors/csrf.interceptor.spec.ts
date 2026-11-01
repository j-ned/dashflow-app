import { describe, it, expect, beforeEach } from 'vitest';
import { HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { csrfInterceptor } from './csrf.interceptor';
import { CsrfStore } from '@core/services/csrf/csrf-store';

function run(method: string): HttpRequest<unknown> | null {
  let captured: HttpRequest<unknown> | null = null;
  const next: HttpHandlerFn = (r) => {
    captured = r;
    return { subscribe: () => ({}) } as never;
  };
  const body = method === 'GET' ? undefined : {};
  TestBed.runInInjectionContext(() =>
    csrfInterceptor(new HttpRequest(method as 'POST', '/x', body as never, {}), next),
  );
  return captured;
}

describe('csrfInterceptor', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
    TestBed.inject(CsrfStore).setToken('tok123');
  });

  it('pose X-CSRF-Token sur POST depuis le CsrfStore', () => {
    expect(run('POST')?.headers.get('X-CSRF-Token')).toBe('tok123');
  });
  it('ne pose pas X-CSRF-Token sur GET', () => {
    expect(run('GET')?.headers.get('X-CSRF-Token')).toBeNull();
  });
  it('ne pose pas de header si aucun token en mémoire', () => {
    TestBed.inject(CsrfStore).setToken(null);
    expect(run('POST')?.headers.get('X-CSRF-Token')).toBeNull();
  });
});
