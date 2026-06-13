import { PLAN_CATALOG, type Feature, type PlanKey, type PlanLimits } from './plan-catalog';

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete';

export type EntitlementSource = 'free' | 'stripe' | 'admin';

export interface SubscriptionSnapshot {
  planKey: PlanKey;
  status: SubscriptionStatus;
  source: EntitlementSource;
  currentPeriodEnd: Date | null;
}

export interface ResolvedEntitlement {
  planKey: PlanKey;
  features: Feature[];
  limits: PlanLimits;
}

const ACTIVE_STATUSES: readonly SubscriptionStatus[] = ['active', 'trialing'];

function toEntitlement(key: PlanKey): ResolvedEntitlement {
  const plan = PLAN_CATALOG[key];
  return { planKey: key, features: [...plan.features], limits: { ...plan.limits } };
}

/** Calcule l'entitlement effectif. Dégrade vers `solo` plutôt qu'une coupure brutale. */
export function resolveEntitlement(
  sub: SubscriptionSnapshot | null,
  now: Date,
): ResolvedEntitlement {
  if (!sub) return toEntitlement('solo');
  if (sub.source === 'admin') return toEntitlement(sub.planKey);

  const isActiveStatus = ACTIVE_STATUSES.includes(sub.status);
  const notExpired =
    sub.currentPeriodEnd === null || sub.currentPeriodEnd.getTime() > now.getTime();

  return isActiveStatus && notExpired ? toEntitlement(sub.planKey) : toEntitlement('solo');
}
