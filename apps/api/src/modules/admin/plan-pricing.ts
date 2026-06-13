import type { PlanKey } from '../entitlements/plan-catalog';

/** Prix mensuels affichés (EUR) — sert au calcul du MRR estimé. */
export const PLAN_MONTHLY_PRICE: Record<PlanKey, number> = {
  solo: 0,
  family: 6.99,
  family_health: 11.99,
};
