export type PlanKey = 'solo' | 'family' | 'family_health';

export type Feature =
  | 'budget.core'
  | 'budget.advanced'
  | 'budget.import'
  | 'family.sharing'
  | 'analytics.forecast'
  | 'medical.access'
  | 'storage.documents';

export interface PlanLimits {
  /** `null` = illimité. */
  bankAccounts: number | null;
  members: number | null;
  storageBytes: number;
}

export interface PlanDefinition {
  key: PlanKey;
  features: Feature[];
  limits: PlanLimits;
  stripePriceEnv?: 'STRIPE_PRICE_FAMILY' | 'STRIPE_PRICE_FAMILY_HEALTH';
}

const GIGA = 1024 ** 3;

const FAMILY_FEATURES: Feature[] = [
  'budget.core',
  'budget.advanced',
  'budget.import',
  'family.sharing',
  'analytics.forecast',
];

export const PLAN_CATALOG: Record<PlanKey, PlanDefinition> = {
  solo: {
    key: 'solo',
    features: ['budget.core'],
    limits: { bankAccounts: 1, members: 1, storageBytes: 0 },
  },
  family: {
    key: 'family',
    features: [...FAMILY_FEATURES],
    // Pas de stockage documents : les documents sont liés à un patient (médical),
    // réservé à family_health via la capacité `storage.documents`.
    limits: { bankAccounts: null, members: null, storageBytes: 0 },
    stripePriceEnv: 'STRIPE_PRICE_FAMILY',
  },
  family_health: {
    key: 'family_health',
    features: [...FAMILY_FEATURES, 'medical.access', 'storage.documents'],
    limits: { bankAccounts: null, members: null, storageBytes: 10 * GIGA },
    stripePriceEnv: 'STRIPE_PRICE_FAMILY_HEALTH',
  },
};
