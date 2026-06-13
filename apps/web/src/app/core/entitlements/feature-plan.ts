import type { Feature, PlanKey } from './entitlement.types';

export const FEATURE_PLAN: Record<Feature, PlanKey> = {
  'medical.access': 'family_health',
  'budget.advanced': 'family',
  'budget.import': 'family',
  'family.sharing': 'family',
};
