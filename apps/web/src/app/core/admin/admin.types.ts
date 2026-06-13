import type { PlanKey } from '@core/entitlements/entitlement.types';

export type { PlanKey };

export type PlanSource = 'stripe' | 'admin' | 'free';

export type SubStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | null;

export type AdminUserView = {
  readonly id: string;
  readonly email: string;
  readonly role: 'user' | 'admin';
  readonly isDemoAccount: boolean;
  readonly createdAt: string;
  readonly effectivePlan: PlanKey;
  readonly status: SubStatus;
  readonly source: PlanSource;
  readonly currentPeriodEnd: string | null;
  readonly hasStripeCustomer: boolean;
  readonly paid: boolean;
};

export type AdminMetrics = {
  readonly totalUsers: number;
  readonly byPlan: {
    readonly solo: number;
    readonly family: number;
    readonly family_health: number;
  };
  readonly activeSubscriptions: number;
  readonly trialing: number;
  readonly pastDue: number;
  readonly mrr: number;
};

export type AdminUsersPage = {
  readonly items: readonly AdminUserView[];
  readonly total: number;
};
