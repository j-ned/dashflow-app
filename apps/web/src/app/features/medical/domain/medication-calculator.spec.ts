import { describe, expect, it } from 'vitest';
import { computeMedicationStock } from './medication-calculator';
import { Medication } from './models/medication.model';

// Mercredi 16 septembre 2026.
const NOW = new Date(2026, 8, 16, 12);

const med = (overrides: Partial<Medication>): Medication =>
  ({
    id: 'm1',
    patientId: 'p1',
    prescriptionId: null,
    name: 'X',
    type: 'comprime',
    dosage: '1',
    quantity: 30,
    dailyRate: 1,
    startDate: '2026-09-01',
    alertDaysBefore: 7,
    skipDays: [],
    ...overrides,
  }) as Medication;

describe('computeMedicationStock', () => {
  it('quantity = stock au startDate : la consommation écoulée est déduite', () => {
    const s = computeMedicationStock(med({}), NOW);
    expect(s.remainingQuantity).toBe(15);
    expect(s.daysRemaining).toBe(15);
    expect(s.isLow).toBe(false);
  });

  it('skipDays : les jours sautés ne consomment pas', () => {
    const s = computeMedicationStock(
      med({ quantity: 7, startDate: '2026-09-14', skipDays: [0, 6], alertDaysBefore: 3 }),
      NOW,
    );
    expect(s.remainingQuantity).toBe(5);
    expect(s.daysRemaining).toBe(7);
    expect(s.takeDaysRemaining).toBe(5);
  });

  it('startDate à venir : rupture comptée depuis le début du traitement, pas depuis aujourd’hui (règle serveur)', () => {
    // 10 comprimés, 2/jour dès le 1er octobre → rupture le 5 octobre = 15 jours d'attente + 5.
    const s = computeMedicationStock(
      med({ quantity: 10, dailyRate: 2, startDate: '2026-10-01', alertDaysBefore: 7 }),
      NOW,
    );
    expect(s.remainingQuantity).toBe(10);
    expect(s.daysRemaining).toBe(20);
    expect(s.isLow).toBe(false);
    expect(s.estimatedRunOut).toContain('5 octobre 2026');
  });
});
