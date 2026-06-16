import { describe, it, expect, vi } from 'vitest';
import { AdminController } from './admin.controller';
import type { AdminService } from './admin.service';

const svc = (over: Partial<AdminService> = {}): AdminService =>
  ({
    listUsers: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    ...over,
  }) as unknown as AdminService;

describe('AdminController', () => {
  it('users : convertit page/pageSize en limit/offset', async () => {
    const service = svc();
    const c = new AdminController(service);
    await c.users({ search: 'a', page: 2, pageSize: 20 });
    expect(service.listUsers).toHaveBeenCalledWith({ search: 'a', limit: 20, offset: 20 });
  });

  it('users : applique les valeurs par défaut (page 1, pageSize 20) sans query', async () => {
    const service = svc();
    const c = new AdminController(service);
    await c.users({});
    expect(service.listUsers).toHaveBeenCalledWith({ search: undefined, limit: 20, offset: 0 });
  });
});
