import { describe, expect, it } from 'vitest';
import { demoShift, previousMonth } from './demo-rebase';

describe('demoShift', () => {
  it('jours : semaines entières écoulées (les jours de la semaine sont conservés)', () => {
    // 2026-06-11 → 2026-09-20 : 101 jours, soit 14 semaines pleines.
    expect(demoShift('2026-06-11', '2026-09-20').days).toBe(98);
    expect(demoShift('2026-06-11', '2026-06-17').days).toBe(0);
    expect(demoShift('2026-06-11', '2026-06-18').days).toBe(7);
  });

  it.each([
    ['2026-06-11', '2026-06-30', 0],
    ['2026-06-11', '2026-07-01', 1],
    ['2026-06-11', '2026-09-20', 3],
    ['2026-06-11', '2027-02-03', 8],
  ])(
    'mois : de %s à %s → %i (différence de mois calendaires)',
    (ref, today, months) => {
      expect(demoShift(ref, today).months).toBe(months);
    },
  );

  it('snapshot daté du futur (horloge, capture tardive) : aucun recalage, jamais de négatif', () => {
    expect(demoShift('2026-09-25', '2026-09-20')).toEqual({
      days: 0,
      months: 0,
    });
  });
});

describe('previousMonth', () => {
  it.each([
    ['2026-09-20', '2026-08'],
    ['2026-01-05', '2025-12'],
    ['2026-10-31', '2026-09'],
  ])('%s → %s', (today, expected) => {
    expect(previousMonth(today)).toBe(expected);
  });
});
