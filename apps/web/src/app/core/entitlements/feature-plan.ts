import type { Feature, PlanKey } from './entitlement.types';

/** Plan minimal qui débloque chaque capacité gatée. Miroir du catalogue back. */
export const FEATURE_PLAN: Record<Feature, PlanKey> = {
  'medical.access': 'family_health',
  'budget.advanced': 'family',
  'budget.import': 'family',
  'family.sharing': 'family',
};
