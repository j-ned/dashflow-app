import { describe, it, expect, vi } from 'vitest';
import {
  honoTestApp,
  jsonInit,
  TEST_USER,
} from '../../../test/support/hono-test-app';
import type { AdminService } from '../../modules/admin/admin.service';

const ADMIN = { ...TEST_USER, role: 'admin' as const };

function adminMock() {
  return {
    listUsers: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    sendNotices: vi
      .fn()
      .mockResolvedValue({ reason: 'reconnect', sent: [], skipped: [] }),
  };
}

async function adminApp(svc: ReturnType<typeof adminMock>) {
  return honoTestApp({ admin: svc as unknown as AdminService }, ADMIN);
}

describe('Routes /admin (Hono)', () => {
  it('GET /users : convertit page/pageSize en limit/offset', async () => {
    const svc = adminMock();
    const t = await adminApp(svc);
    const res = await t.authed('/admin/users?search=a&page=2&pageSize=20');
    expect(res.status).toBe(200);
    expect(svc.listUsers).toHaveBeenCalledWith({
      search: 'a',
      limit: 20,
      offset: 20,
    });
  });

  it('GET /users : applique les valeurs par défaut (page 1, pageSize 20) sans query', async () => {
    const svc = adminMock();
    const t = await adminApp(svc);
    expect((await t.authed('/admin/users')).status).toBe(200);
    expect(svc.listUsers).toHaveBeenCalledWith({
      search: undefined,
      limit: 20,
      offset: 0,
    });
  });

  it("POST /notices : valide le motif et transmet la sélection et l'auteur", async () => {
    const svc = adminMock();
    const t = await adminApp(svc);
    const id = '7b0a3f0e-2f0b-4b5e-9d65-0d4f4c7a1e11';
    const res = await t.authed(
      '/admin/notices',
      jsonInit('POST', { reason: 'reconnect', userIds: [id] }),
    );
    expect(res.status).toBe(200);
    expect(svc.sendNotices).toHaveBeenCalledWith('reconnect', [id], ADMIN.id);
  });

  it('POST /notices : refuse (400) un motif inconnu ou un texte libre, sans appeler le service', async () => {
    const svc = adminMock();
    const t = await adminApp(svc);
    const res = await t.authed(
      '/admin/notices',
      jsonInit('POST', { reason: 'promo', message: 'cliquez ici' }),
    );
    expect(res.status).toBe(400);
    expect(svc.sendNotices).not.toHaveBeenCalled();
  });
});
