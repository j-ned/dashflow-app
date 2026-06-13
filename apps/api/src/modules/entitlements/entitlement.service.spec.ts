import { describe, it, expect } from 'vitest';
import { EntitlementService } from './entitlement.service';
import type { SubscriptionRepository, SubscriptionRow } from './subscription.repository';

function makeRepo(row: SubscriptionRow | null): SubscriptionRepository {
  return { findByUserId: async () => row } as unknown as SubscriptionRepository;
}

function row(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    id: 'sub-1',
    userId: 'user-1',
    planKey: 'family',
    status: 'active',
    source: 'stripe',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodEnd: new Date('2999-01-01T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as SubscriptionRow;
}

describe('EntitlementService', () => {
  it('sans souscription → solo', async () => {
    const svc = new EntitlementService(makeRepo(null));
    const e = await svc.getForUser('user-1');
    expect(e.planKey).toBe('solo');
  });

  it('souscription family active → family', async () => {
    const svc = new EntitlementService(makeRepo(row({ planKey: 'family' })));
    const e = await svc.getForUser('user-1');
    expect(e.planKey).toBe('family');
    expect(e.features).toContain('budget.import');
  });

  it('souscription canceled → solo', async () => {
    const svc = new EntitlementService(makeRepo(row({ status: 'canceled' })));
    const e = await svc.getForUser('user-1');
    expect(e.planKey).toBe('solo');
  });
});
