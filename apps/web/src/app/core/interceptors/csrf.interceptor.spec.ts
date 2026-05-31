import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { csrfInterceptor } from './csrf.interceptor';

function run(method: string): HttpRequest<unknown> | null {
  let captured: HttpRequest<unknown> | null = null;
  const next: HttpHandlerFn = (r) => { captured = r; return { subscribe: () => ({}) } as never; };
  const body = method === 'GET' ? undefined : {};
  csrfInterceptor(new HttpRequest(method as 'POST', '/api/x', body as never, {}), next);
  return captured;
}

describe('csrfInterceptor', () => {
  beforeEach(() => { document.cookie = 'dashflow_csrf=tok123; path=/'; });
  afterEach(() => { document.cookie = 'dashflow_csrf=; path=/; max-age=0'; });

  it('pose X-CSRF-Token sur POST depuis le cookie', () => {
    expect(run('POST')?.headers.get('X-CSRF-Token')).toBe('tok123');
  });
  it('ne pose pas X-CSRF-Token sur GET', () => {
    expect(run('GET')?.headers.get('X-CSRF-Token')).toBeNull();
  });
});
