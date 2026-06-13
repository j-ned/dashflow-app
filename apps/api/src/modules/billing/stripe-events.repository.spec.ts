import { describe, it, expect } from 'vitest';
import { StripeEventsRepository } from './stripe-events.repository';
import type { DrizzleDB } from '../../db/drizzle.constants';

function db(returning: unknown[]): DrizzleDB {
  return {
    insert: () => ({
      values: () => ({ onConflictDoNothing: () => ({ returning: async () => returning }) }),
    }),
  } as unknown as DrizzleDB;
}

describe('StripeEventsRepository.markProcessed', () => {
  it('renvoie true quand l’event est nouveau (ligne insérée)', async () => {
    const repo = new StripeEventsRepository(db([{ id: 'x' }]));
    expect(await repo.markProcessed('evt_1', 'checkout.session.completed')).toBe(true);
  });
  it('renvoie false quand l’event a déjà été traité (conflit, 0 ligne)', async () => {
    const repo = new StripeEventsRepository(db([]));
    expect(await repo.markProcessed('evt_1', 'checkout.session.completed')).toBe(false);
  });
});
