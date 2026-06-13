import { describe, it, expect, vi } from 'vitest';
import { AdminService } from './admin.service';
import type { AdminRepository, AdminUserRow } from './admin.repository';
import type { SubscriptionRepository } from '../entitlements/subscription.repository';

function row(over: Partial<AdminUserRow> = {}): AdminUserRow {
  return {
    id: 'u1', email: 'a@b.com', role: 'user', isDemoAccount: false, createdAt: new Date('2026-01-01'),
    planKey: null, status: null, source: null, currentPeriodEnd: null, stripeCustomerId: null,
    ...over,
  };
}
const repo = (rows: AdminUserRow[], total = rows.length): AdminRepository =>
  ({ listUsersWithSubscription: vi.fn().mockResolvedValue(rows), countAll: vi.fn().mockResolvedValue(total) }) as unknown as AdminRepository;
const subRepo = (): SubscriptionRepository =>
  ({ upsertByUserId: vi.fn().mockResolvedValue({}) }) as unknown as SubscriptionRepository;

describe('AdminService.listUsers', () => {
  it('mappe chaque user vers son plan effectif (sans souscription → solo)', async () => {
    const svc = new AdminService(repo([row()]), subRepo());
    const res = await svc.listUsers({ limit: 20, offset: 0 });
    expect(res.total).toBe(1);
    expect(res.items[0]).toMatchObject({ email: 'a@b.com', effectivePlan: 'solo', status: null, paid: false });
  });

  it('un abonné stripe actif est marqué payé', async () => {
    const svc = new AdminService(repo([row({ planKey: 'family', status: 'active', source: 'stripe' })]), subRepo());
    const res = await svc.listUsers({ limit: 20, offset: 0 });
    expect(res.items[0]).toMatchObject({ effectivePlan: 'family', paid: true });
  });

  it('un abonnement canceled est dégradé en solo (effectif)', async () => {
    const svc = new AdminService(repo([row({ planKey: 'family', status: 'canceled', source: 'stripe' })]), subRepo());
    const res = await svc.listUsers({ limit: 20, offset: 0 });
    expect(res.items[0]).toMatchObject({ effectivePlan: 'solo', paid: false });
  });
});

describe('AdminService.metrics', () => {
  it('compte par plan effectif + MRR des abonnés stripe actifs', async () => {
    const rows = [
      row({ planKey: 'family', status: 'active', source: 'stripe' }),
      row({ id: 'u2', planKey: 'family_health', status: 'active', source: 'stripe' }),
      row({ id: 'u3' }),
      row({ id: 'u4', planKey: 'family', status: 'past_due', source: 'stripe' }),
    ];
    const svc = new AdminService(repo(rows, 4), subRepo());
    const m = await svc.metrics();
    expect(m.totalUsers).toBe(4);
    expect(m.byPlan).toMatchObject({ solo: 2, family: 1, family_health: 1 });
    expect(m.mrr).toBeCloseTo(6.99 + 11.99, 2);
    expect(m.pastDue).toBe(1);
  });
});

describe('AdminService.overridePlan', () => {
  it('upsert le plan avec source admin', async () => {
    const subs = subRepo();
    const svc = new AdminService(repo([]), subs);
    await svc.overridePlan('u1', 'family_health');
    expect(subs.upsertByUserId).toHaveBeenCalledWith('u1', { planKey: 'family_health', status: 'active', source: 'admin' });
  });
});
