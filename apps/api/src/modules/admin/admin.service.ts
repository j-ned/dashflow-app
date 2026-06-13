import { Injectable } from '@nestjs/common';
import { AdminRepository, type AdminUserRow } from './admin.repository';
import { SubscriptionRepository } from '../entitlements/subscription.repository';
import {
  resolveEntitlement,
  type SubscriptionSnapshot,
  type SubscriptionStatus,
  type EntitlementSource,
} from '../entitlements/entitlement.resolver';
import { PLAN_MONTHLY_PRICE } from './plan-pricing';
import { PLAN_CATALOG, type PlanKey } from '../entitlements/plan-catalog';

export type AdminUserView = {
  id: string;
  email: string;
  role: string;
  isDemoAccount: boolean;
  createdAt: Date;
  effectivePlan: PlanKey;
  status: SubscriptionStatus | null;
  source: EntitlementSource | null;
  currentPeriodEnd: Date | null;
  hasStripeCustomer: boolean;
  paid: boolean;
};

const ACTIVE: ReadonlyArray<string> = ['active', 'trialing'];

function snapshot(row: AdminUserRow): SubscriptionSnapshot | null {
  if (!row.planKey || !row.status || !row.source) return null;
  return {
    planKey: row.planKey as PlanKey,
    status: row.status as SubscriptionStatus,
    source: row.source as EntitlementSource,
    currentPeriodEnd: row.currentPeriodEnd,
  };
}

function toView(row: AdminUserRow, now: Date): AdminUserView {
  const effective = resolveEntitlement(snapshot(row), now).planKey;
  const paid = row.source === 'stripe' && !!row.status && ACTIVE.includes(row.status);
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    isDemoAccount: row.isDemoAccount,
    createdAt: row.createdAt,
    effectivePlan: effective,
    status: (row.status as SubscriptionStatus | null) ?? null,
    source: (row.source as EntitlementSource | null) ?? null,
    currentPeriodEnd: row.currentPeriodEnd,
    hasStripeCustomer: !!row.stripeCustomerId,
    paid,
  };
}

@Injectable()
export class AdminService {
  constructor(
    private readonly admin: AdminRepository,
    private readonly subscriptions: SubscriptionRepository,
  ) {}

  async listUsers(opts: {
    search?: string;
    limit: number;
    offset: number;
  }): Promise<{ items: AdminUserView[]; total: number }> {
    const now = new Date();
    const [rows, total] = await Promise.all([
      this.admin.listUsersWithSubscription(opts),
      this.admin.countAll(opts.search),
    ]);
    return { items: rows.map((r) => toView(r, now)), total };
  }

  async metrics(): Promise<{
    totalUsers: number;
    byPlan: Record<PlanKey, number>;
    activeSubscriptions: number;
    trialing: number;
    pastDue: number;
    mrr: number;
  }> {
    const now = new Date();
    const rows = await this.admin.listUsersWithSubscription({ limit: 100000, offset: 0 });
    const byPlan: Record<PlanKey, number> = { solo: 0, family: 0, family_health: 0 };
    let activeSubscriptions = 0;
    let trialing = 0;
    let pastDue = 0;
    let mrr = 0;
    for (const r of rows) {
      const effective = resolveEntitlement(snapshot(r), now).planKey;
      byPlan[effective] += 1;
      if (r.status === 'past_due') pastDue += 1;
      if (r.source === 'stripe' && r.status && ACTIVE.includes(r.status)) {
        if (r.status === 'trialing') trialing += 1;
        else activeSubscriptions += 1;
        mrr += PLAN_MONTHLY_PRICE[r.planKey as PlanKey] ?? 0;
      }
    }
    return { totalUsers: rows.length, byPlan, activeSubscriptions, trialing, pastDue, mrr };
  }

  async overridePlan(userId: string, planKey: PlanKey): Promise<void> {
    if (!PLAN_CATALOG[planKey]) return;
    await this.subscriptions.upsertByUserId(userId, { planKey, status: 'active', source: 'admin' });
  }
}
