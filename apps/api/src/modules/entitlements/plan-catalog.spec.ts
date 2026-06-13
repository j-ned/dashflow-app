import { describe, it, expect } from 'vitest';
import { PLAN_CATALOG, type PlanKey } from './plan-catalog';

describe('PLAN_CATALOG', () => {
  it('expose exactement les 3 plans', () => {
    expect(Object.keys(PLAN_CATALOG).sort()).toEqual(['family', 'family_health', 'solo']);
  });

  it('solo est limité : budget.core seul, 1 compte, 1 membre, 0 stockage', () => {
    const solo = PLAN_CATALOG.solo;
    expect(solo.features).toEqual(['budget.core']);
    expect(solo.limits).toEqual({ bankAccounts: 1, members: 1, storageBytes: 0 });
    expect(solo.stripePriceEnv).toBeUndefined();
  });

  it('family débloque budget avancé, import, partage, prévisions, comptes/membres illimités', () => {
    const family = PLAN_CATALOG.family;
    expect(family.features).toContain('budget.advanced');
    expect(family.features).toContain('budget.import');
    expect(family.features).toContain('family.sharing');
    expect(family.features).toContain('analytics.forecast');
    expect(family.features).not.toContain('medical.access');
    expect(family.limits.bankAccounts).toBeNull();
    expect(family.limits.members).toBeNull();
    expect(family.stripePriceEnv).toBe('STRIPE_PRICE_FAMILY');
  });

  it('family_health est un sur-ensemble strict de family + médical + stockage documents', () => {
    const family = PLAN_CATALOG.family;
    const fh = PLAN_CATALOG.family_health;
    for (const f of family.features) expect(fh.features).toContain(f);
    expect(fh.features).toContain('medical.access');
    expect(fh.features).toContain('storage.documents');
    expect(fh.limits.storageBytes).toBeGreaterThan(family.limits.storageBytes);
    expect(fh.stripePriceEnv).toBe('STRIPE_PRICE_FAMILY_HEALTH');
  });

  it('aucune limite numérique négative', () => {
    for (const key of Object.keys(PLAN_CATALOG) as PlanKey[]) {
      expect(PLAN_CATALOG[key].limits.storageBytes).toBeGreaterThanOrEqual(0);
    }
  });
});
