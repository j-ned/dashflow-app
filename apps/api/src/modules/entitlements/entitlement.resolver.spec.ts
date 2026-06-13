import { describe, it, expect } from 'vitest';
import { resolveEntitlement, type SubscriptionSnapshot } from './entitlement.resolver';

const NOW = new Date('2026-06-13T00:00:00.000Z');
const FUTURE = new Date('2026-07-13T00:00:00.000Z');
const PAST = new Date('2026-05-13T00:00:00.000Z');

function snap(overrides: Partial<SubscriptionSnapshot> = {}): SubscriptionSnapshot {
  return {
    planKey: 'family',
    status: 'active',
    source: 'stripe',
    currentPeriodEnd: FUTURE,
    ...overrides,
  };
}

describe('resolveEntitlement', () => {
  it('aucune souscription → solo', () => {
    const e = resolveEntitlement(null, NOW);
    expect(e.planKey).toBe('solo');
    expect(e.features).toEqual(['budget.core']);
  });

  it('stripe active non expirée → le plan', () => {
    expect(resolveEntitlement(snap({ planKey: 'family_health' }), NOW).planKey).toBe('family_health');
  });

  it('stripe trialing → le plan', () => {
    expect(resolveEntitlement(snap({ status: 'trialing' }), NOW).planKey).toBe('family');
  });

  it('canceled → dégrade vers solo', () => {
    expect(resolveEntitlement(snap({ status: 'canceled' }), NOW).planKey).toBe('solo');
  });

  it('past_due → dégrade vers solo', () => {
    expect(resolveEntitlement(snap({ status: 'past_due' }), NOW).planKey).toBe('solo');
  });

  it('active mais période expirée → dégrade vers solo', () => {
    expect(resolveEntitlement(snap({ currentPeriodEnd: PAST }), NOW).planKey).toBe('solo');
  });

  it('source admin → applique le plan même si status non actif (override SAV)', () => {
    const e = resolveEntitlement(snap({ source: 'admin', status: 'canceled', planKey: 'family_health', currentPeriodEnd: PAST }), NOW);
    expect(e.planKey).toBe('family_health');
    expect(e.features).toContain('medical.access');
  });

  it('retourne des copies (pas de mutation du catalogue)', () => {
    const e = resolveEntitlement(snap(), NOW);
    e.features.push('medical.access');
    const again = resolveEntitlement(snap(), NOW);
    expect(again.features).not.toContain('medical.access');
  });
});
