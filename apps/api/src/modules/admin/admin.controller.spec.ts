import { describe, it, expect, vi } from 'vitest';
import { AdminController } from './admin.controller';
import type { AdminService } from './admin.service';

const svc = (over: Partial<AdminService> = {}): AdminService =>
  ({
    listUsers: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    sendNotices: vi
      .fn()
      .mockResolvedValue({ reason: 'reconnect', sent: [], skipped: [] }),
    ...over,
  }) as unknown as AdminService;

describe('AdminController', () => {
  it('users : convertit page/pageSize en limit/offset', async () => {
    const service = svc();
    const c = new AdminController(service);
    await c.users({ search: 'a', page: 2, pageSize: 20 });
    expect(service.listUsers).toHaveBeenCalledWith({
      search: 'a',
      limit: 20,
      offset: 20,
    });
  });

  it('users : applique les valeurs par défaut (page 1, pageSize 20) sans query', async () => {
    const service = svc();
    const c = new AdminController(service);
    await c.users({});
    expect(service.listUsers).toHaveBeenCalledWith({
      search: undefined,
      limit: 20,
      offset: 0,
    });
  });

  it("notices : valide le motif et transmet la sélection et l'auteur", async () => {
    const service = svc();
    const c = new AdminController(service);
    const id = '7b0a3f0e-2f0b-4b5e-9d65-0d4f4c7a1e11';
    await c.sendNotices({ id: 'admin1' } as never, {
      reason: 'reconnect',
      userIds: [id],
    });
    expect(service.sendNotices).toHaveBeenCalledWith(
      'reconnect',
      [id],
      'admin1',
    );
  });

  it('notices : refuse un motif inconnu ou un texte libre', () => {
    const c = new AdminController(svc());
    expect(() =>
      c.sendNotices({ id: 'a' } as never, {
        reason: 'promo',
        message: 'cliquez ici',
      }),
    ).toThrow();
  });
});
