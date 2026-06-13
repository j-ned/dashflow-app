import type { AdminMetrics, AdminUserView } from './admin.types';

export function anAdminUser(over: Partial<AdminUserView> = {}): AdminUserView {
  return {
    id: 'u1',
    email: 'user@example.com',
    role: 'user',
    isDemoAccount: false,
    createdAt: '2026-01-15T10:00:00.000Z',
    effectivePlan: 'solo',
    status: 'active',
    source: 'stripe',
    currentPeriodEnd: '2026-07-15T10:00:00.000Z',
    hasStripeCustomer: true,
    paid: true,
    ...over,
  };
}

export function adminMetrics(over: Partial<AdminMetrics> = {}): AdminMetrics {
  return {
    totalUsers: 42,
    byPlan: { solo: 20, family: 15, family_health: 7 },
    activeSubscriptions: 30,
    trialing: 5,
    pastDue: 2,
    mrr: 18.98,
    ...over,
  };
}
