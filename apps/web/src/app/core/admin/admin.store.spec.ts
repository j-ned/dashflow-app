import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { AdminStore } from './admin.store';
import { anAdminUser, adminMetrics } from './admin.builder';
import { Toaster } from '@shared/components/toast/toast';

const BASE = environment.apiUrl;
const USERS_URL = `${BASE}/admin/users`;
const METRICS_URL = `${BASE}/admin/metrics`;

const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

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
    it('users vide, total 0, metrics null, loading false', () => {
      expect(store.users()).toEqual([]);
      expect(store.total()).toBe(0);
      expect(store.metrics()).toBeNull();
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

  describe('loadMetrics', () => {
    it('GET /admin/metrics et peuple metrics()', async () => {
      const promise = store.loadMetrics();

      const req = httpMock.expectOne((r) => r.method === 'GET' && r.url === METRICS_URL);
      const metrics = adminMetrics({ mrr: 18.98, pastDue: 3 });
      req.flush(metrics);
      await promise;

      expect(store.metrics()).toEqual(metrics);
      expect(store.metrics()?.mrr).toBe(18.98);
    });

    it('sur erreur HTTP : Toaster.error appelé, metrics reste null', async () => {
      const promise = store.loadMetrics();
      httpMock
        .expectOne((r) => r.url === METRICS_URL)
        .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
      await promise;

      expect(toaster.error).toHaveBeenCalledTimes(1);
      expect(store.metrics()).toBeNull();
    });
  });

  describe('overridePlan', () => {
    it('PATCH /admin/users/:id/plan avec body { planKey } puis recharge users + metrics', async () => {
      const seed = store.loadUsers({ search: 'a', page: 2, pageSize: 20 });
      httpMock
        .expectOne((r) => r.url === USERS_URL)
        .flush({ items: [anAdminUser({ id: 'u1' })], total: 1 });
      await seed;

      const promise = store.overridePlan('u1', 'family');

      const patch = httpMock.expectOne(
        (r) => r.method === 'PATCH' && r.url === `${BASE}/admin/users/u1/plan`,
      );
      expect(patch.request.body).toEqual({ planKey: 'family' });
      patch.flush({ ok: true });
      await flushMicrotasks();

      const reloadUsers = httpMock.expectOne((r) => r.method === 'GET' && r.url === USERS_URL);
      expect(reloadUsers.request.params.get('search')).toBe('a');
      expect(reloadUsers.request.params.get('page')).toBe('2');
      reloadUsers.flush({ items: [anAdminUser({ id: 'u1', effectivePlan: 'family' })], total: 1 });
      await flushMicrotasks();

      const reloadMetrics = httpMock.expectOne((r) => r.method === 'GET' && r.url === METRICS_URL);
      reloadMetrics.flush(adminMetrics());

      await promise;

      expect(toaster.success).toHaveBeenCalledTimes(1);
      expect(store.users()[0].effectivePlan).toBe('family');
    });

    it('sur erreur du PATCH : Toaster.error appelé, pas de rechargement', async () => {
      const promise = store.overridePlan('u1', 'family');
      httpMock
        .expectOne((r) => r.method === 'PATCH' && r.url === `${BASE}/admin/users/u1/plan`)
        .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
      await promise;

      expect(toaster.error).toHaveBeenCalledTimes(1);
      expect(toaster.success).not.toHaveBeenCalled();
      httpMock.expectNone((r) => r.url === METRICS_URL);
    });
  });
});
