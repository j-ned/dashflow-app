export type PlanKey = 'solo' | 'family' | 'family_health';

export type Feature = 'medical.access' | 'budget.import' | 'budget.advanced' | 'family.sharing';

export type PlanLimits = {
  readonly bankAccounts: number | null;
  readonly members: number | null;
  readonly storageBytes: number;
};

export type Entitlement = {
  readonly planKey: PlanKey;
  readonly features: readonly Feature[];
  readonly limits: PlanLimits;
};
