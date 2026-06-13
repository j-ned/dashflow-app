import type { PlanKey } from './entitlement.types';

/** Structure des 3 plans (ordre, plan recommandé, clés i18n des features). Libellés dans `pricing.*`. */
export type PricingPlanView = {
  readonly key: PlanKey;
  readonly recommended: boolean;
  readonly featureKeys: readonly string[];
};

export const PRICING_PLANS: readonly PricingPlanView[] = [
  {
    key: 'solo',
    recommended: false,
    featureKeys: [
      'pricing.plans.solo.f1',
      'pricing.plans.solo.f2',
      'pricing.plans.solo.f3',
      'pricing.plans.solo.f4',
    ],
  },
  {
    key: 'family',
    recommended: true,
    featureKeys: [
      'pricing.plans.family.f1',
      'pricing.plans.family.f2',
      'pricing.plans.family.f3',
      'pricing.plans.family.f4',
    ],
  },
  {
    key: 'family_health',
    recommended: false,
    featureKeys: [
      'pricing.plans.family_health.f1',
      'pricing.plans.family_health.f2',
      'pricing.plans.family_health.f3',
    ],
  },
];
