import { describe, it, expect, vi } from 'vitest';
import { AdminController } from './admin.controller';
import type { AdminService } from './admin.service';

const svc = (over: Partial<AdminService> = {}): AdminService =>
  ({
    listUsers: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    metrics: vi.fn().mockResolvedValue({ totalUsers: 0, byPlan: { solo: 0, family: 0, family_health: 0 }, activeSubscriptions: 0, trialing: 0, pastDue: 0, mrr: 0 }),
    overridePlan: vi.fn().mockResolvedValue(undefined),
    ...over,
  }) as unknown as AdminService;

describe('AdminController', () => {
  it('users : convertit page/pageSize en limit/offset', async () => {
    const service = svc();
    const c = new AdminController(service);
    await c.users({ search: 'a', page: 2, pageSize: 20 });
    expect(service.listUsers).toHaveBeenCalledWith({ search: 'a', limit: 20, offset: 20 });
  });

  it('metrics : délègue au service', async () => {
    const service = svc();
    const c = new AdminController(service);
    const m = await c.metrics();
    expect(m.totalUsers).toBe(0);
  });

  it('override : passe id + planKey', async () => {
    const service = svc();
    const c = new AdminController(service);
    const res = await c.override('u1', { planKey: 'family' });
    expect(service.overridePlan).toHaveBeenCalledWith('u1', 'family');
    expect(res).toEqual({ ok: true });
  });
});
