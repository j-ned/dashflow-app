import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { AdminStore } from './admin.store';
import { anAdminUser } from './admin.builder';
import { Toaster } from '@shared/components/toast/toast';

const BASE = environment.apiUrl;
const USERS_URL = `${BASE}/admin/users`;

describe('AdminStore', () => {
  let store: AdminStore;
  let httpMock: HttpTestingController;
  const toaster = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        AdminStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Toaster, useValue: toaster },
      ],
    });
    store = TestBed.inject(AdminStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('état initial', () => {
    it('users vide, total 0, loading false', () => {
      expect(store.users()).toEqual([]);
      expect(store.total()).toBe(0);
      expect(store.loading()).toBe(false);
    });
  });

  describe('loadUsers', () => {
    it('GET /admin/users avec les query params exacts et peuple users + total', async () => {
      const promise = store.loadUsers({ search: 'a', page: 2, pageSize: 20 });

      const req = httpMock.expectOne((r) => r.method === 'GET' && r.url === USERS_URL);
      expect(req.request.params.get('search')).toBe('a');
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('pageSize')).toBe('20');

      const rows = [anAdminUser({ id: 'u1' }), anAdminUser({ id: 'u2' })];
      req.flush({ items: rows, total: 57 });
      await promise;

      expect(store.users().map((u) => u.id)).toEqual(['u1', 'u2']);
      expect(store.total()).toBe(57);
    });

    it("n'émet pas les clés non définies dans la query", async () => {
      const promise = store.loadUsers({ page: 1, pageSize: 20 });

      const req = httpMock.expectOne((r) => r.method === 'GET' && r.url === USERS_URL);
      expect(req.request.params.has('search')).toBe(false);
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('pageSize')).toBe('20');

      req.flush({ items: [], total: 0 });
      await promise;
    });

    it('passe loading à true pendant la requête puis false après succès', async () => {
      const promise = store.loadUsers({ page: 1, pageSize: 20 });
      expect(store.loading()).toBe(true);

      httpMock.expectOne((r) => r.url === USERS_URL).flush({ items: [], total: 0 });
      await promise;

      expect(store.loading()).toBe(false);
    });

    it('sur erreur HTTP : Toaster.error appelé, pas de crash, loading repasse à false', async () => {
      const promise = store.loadUsers({ page: 1, pageSize: 20 });
      httpMock
        .expectOne((r) => r.url === USERS_URL)
        .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
      await promise;

      expect(toaster.error).toHaveBeenCalledTimes(1);
      expect(store.loading()).toBe(false);
    });
  });
});
