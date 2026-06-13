import { describe, it, expect } from 'vitest';
import { priceIdForPlan, planKeyForPrice, mapStripeStatus } from './plan-price';

const ENV = { STRIPE_PRICE_FAMILY: 'price_fam', STRIPE_PRICE_FAMILY_HEALTH: 'price_fh' } as const;
const get = (k: keyof typeof ENV) => ENV[k];

describe('priceIdForPlan', () => {
  it('renvoie le price id du plan payant', () => {
    expect(priceIdForPlan('family', get)).toBe('price_fam');
    expect(priceIdForPlan('family_health', get)).toBe('price_fh');
  });
  it('rejette un plan non payant (solo)', () => {
    expect(() => priceIdForPlan('solo', get)).toThrow();
  });
});

describe('planKeyForPrice', () => {
  it('retrouve le plan depuis le price id', () => {
    expect(planKeyForPrice('price_fh', get)).toBe('family_health');
    expect(planKeyForPrice('price_fam', get)).toBe('family');
  });
  it('renvoie null pour un price inconnu', () => {
    expect(planKeyForPrice('price_???', get)).toBeNull();
  });
});

describe('mapStripeStatus', () => {
  it('mappe les statuts Stripe vers les nôtres', () => {
    expect(mapStripeStatus('active')).toBe('active');
    expect(mapStripeStatus('trialing')).toBe('trialing');
    expect(mapStripeStatus('past_due')).toBe('past_due');
    expect(mapStripeStatus('canceled')).toBe('canceled');
    expect(mapStripeStatus('unpaid')).toBe('past_due');
    expect(mapStripeStatus('incomplete_expired')).toBe('canceled');
    expect(mapStripeStatus('incomplete')).toBe('incomplete');
  });
});
