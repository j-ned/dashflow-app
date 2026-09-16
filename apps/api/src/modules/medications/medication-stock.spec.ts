import { describe, it, expect } from 'vitest';
import { computeMedicationStock } from './medication-stock';

// Mercredi 16 septembre 2026.
const NOW = new Date(2026, 8, 16, 12);

describe('computeMedicationStock', () => {
  it('quantity = stock au startDate : la consommation écoulée est déduite', () => {
    // 30 comprimés depuis le 1er septembre, 1/jour → 15 consommés, 15 restants → rupture le 30.
    const s = computeMedicationStock(
      {
        quantity: 30,
        dailyRate: '1',
        startDate: '2026-09-01',
        skipDays: [],
        alertDaysBefore: 7,
      },
      NOW,
    );
    expect(s.remainingQuantity).toBe(15);
    expect(s.daysRemaining).toBe(15);
    expect(s.runOutDate).toBe('2026-09-30');
    expect(s.isLow).toBe(false);
  });

  it('skipDays : les jours sautés ne consomment pas, ni avant ni après aujourd’hui', () => {
    // Pas de prise le week-end (0 dimanche, 6 samedi). Depuis le lundi 14/09 : 14 et 15 → 2 pris.
    const s = computeMedicationStock(
      {
        quantity: 7,
        dailyRate: '1',
        startDate: '2026-09-14',
        skipDays: [0, 6],
        alertDaysBefore: 3,
      },
      NOW,
    );
    expect(s.remainingQuantity).toBe(5);
    // 5 prises : mer 16, jeu 17, ven 18, (sam/dim sautés), lun 21, mar 22 → rupture le 22.
    expect(s.runOutDate).toBe('2026-09-22');
    expect(s.daysRemaining).toBe(7);
    expect(s.isLow).toBe(false);
  });

  it('startDate dans le futur : rien consommé, rupture comptée depuis le début du traitement', () => {
    // 10 comprimés, 2/jour à partir du 1er octobre → 5 jours de traitement → rupture le 5 octobre,
    // soit 15 jours d'attente + 5 : pas d'alerte à 7 jours.
    const s = computeMedicationStock(
      {
        quantity: 10,
        dailyRate: '2',
        startDate: '2026-10-01',
        skipDays: [],
        alertDaysBefore: 7,
      },
      NOW,
    );
    expect(s.remainingQuantity).toBe(10);
    expect(s.runOutDate).toBe('2026-10-05');
    expect(s.daysRemaining).toBe(20);
    expect(s.isLow).toBe(false);
  });

  it('stock épuisé : rupture aujourd’hui, alerte', () => {
    const s = computeMedicationStock(
      {
        quantity: 5,
        dailyRate: '1',
        startDate: '2026-09-01',
        skipDays: [],
        alertDaysBefore: 7,
      },
      NOW,
    );
    expect(s.remainingQuantity).toBe(0);
    expect(s.runOutDate).toBe('2026-09-16');
    expect(s.isLow).toBe(true);
  });

  it('rythme nul ou tous les jours sautés : pas de rupture calculable, pas d’alerte', () => {
    const zero = computeMedicationStock(
      {
        quantity: 5,
        dailyRate: '0',
        startDate: '2026-09-01',
        skipDays: [],
        alertDaysBefore: 7,
      },
      NOW,
    );
    expect(zero.runOutDate).toBeNull();
    expect(zero.isLow).toBe(false);
    const allSkipped = computeMedicationStock(
      {
        quantity: 5,
        dailyRate: '1',
        startDate: '2026-09-01',
        skipDays: [0, 1, 2, 3, 4, 5, 6],
        alertDaysBefore: 7,
      },
      NOW,
    );
    expect(allSkipped.runOutDate).toBeNull();
  });

  it('skipDays invalide (non tableau, valeurs hors 0..6) est ignoré', () => {
    const s = computeMedicationStock(
      {
        quantity: 3,
        dailyRate: '1',
        startDate: '2026-09-16',
        skipDays: 'x',
        alertDaysBefore: 7,
      },
      NOW,
    );
    expect(s.daysRemaining).toBe(3);
  });
});
