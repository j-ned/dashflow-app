import type { Entitlement, Feature, PlanKey, PlanLimits } from './entitlement.types';

const DEFAULT_LIMITS: PlanLimits = {
  bankAccounts: 2,
  members: 2,
  storageBytes: 1_000_000,
};

const PLAN_FEATURES: Record<PlanKey, readonly Feature[]> = {
  solo: ['budget.import'],
  family: ['budget.import', 'budget.advanced', 'family.sharing'],
  family_health: ['budget.import', 'budget.advanced', 'family.sharing', 'medical.access'],
};

export function anEntitlement(over: Partial<Entitlement> = {}): Entitlement {
  const planKey = over.planKey ?? 'family_health';
  return {
    planKey,
    features: over.features ?? PLAN_FEATURES[planKey],
    limits: over.limits ?? DEFAULT_LIMITS,
  };
}
