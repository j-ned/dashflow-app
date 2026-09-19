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

  describe('relances', () => {
    const NOTICES_URL = `${BASE}/admin/notices`;

    it('loadSummary : GET /admin/notices/summary et expose les compteurs', async () => {
      const promise = store.loadSummary();
      httpMock.expectOne(`${NOTICES_URL}/summary`).flush({
        reconnect: { eligible: 4, onCooldown: 1 },
        enable_encryption: { eligible: 0, onCooldown: 0 },
        recovery_key: { eligible: 0, onCooldown: 0 },
        enable_2fa: { eligible: 2, onCooldown: 0 },
      });
      await promise;
      expect(store.summary()?.reconnect).toEqual({ eligible: 4, onCooldown: 1 });
    });

    it('sendNotices sélectif : POST avec le motif et les comptes cochés', async () => {
      const promise = store.sendNotices('reconnect', ['u1', 'u2']);
      const req = httpMock.expectOne((r) => r.method === 'POST' && r.url === NOTICES_URL);
      expect(req.request.body).toEqual({ reason: 'reconnect', userIds: ['u1', 'u2'] });
      expect(store.sending()).toBe(true);
      req.flush({ reason: 'reconnect', sent: [{ id: 'u1', email: 'a@b.fr' }], skipped: [] });
      expect((await promise)?.sent).toHaveLength(1);
      expect(store.sending()).toBe(false);
    });

    it('sendNotices groupé : aucun userIds dans le corps', async () => {
      const promise = store.sendNotices('enable_2fa');
      const req = httpMock.expectOne((r) => r.method === 'POST' && r.url === NOTICES_URL);
      expect(req.request.body).toEqual({ reason: 'enable_2fa' });
      req.flush({ reason: 'enable_2fa', sent: [], skipped: [] });
      await promise;
    });

    it("sendNotices en échec : toast d'erreur, rend null, sending retombe", async () => {
      const promise = store.sendNotices('reconnect');
      httpMock
        .expectOne((r) => r.method === 'POST' && r.url === NOTICES_URL)
        .flush('boom', { status: 500, statusText: 'KO' });
      expect(await promise).toBeNull();
      expect(toaster.error).toHaveBeenCalledWith('admin.notices.toast.error');
      expect(store.sending()).toBe(false);
    });
  });
});
