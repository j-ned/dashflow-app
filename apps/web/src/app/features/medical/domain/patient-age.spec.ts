import { describe, expect, it } from 'vitest';
import { computeAge } from './patient-age';

describe('computeAge', () => {
  const NOW = new Date('2026-06-07T12:00:00.000Z');

  it("retourne l'âge plein quand l'anniversaire est déjà passé cette année", () => {
    expect(computeAge('1990-01-01', NOW)).toBe(36);
  });

  it("décrémente quand l'anniversaire tombe un mois plus tard cette année", () => {
    expect(computeAge('1990-12-01', NOW)).toBe(35);
  });

  it("décrémente quand l'anniversaire est le même mois mais un jour plus tard", () => {
    expect(computeAge('1990-06-20', NOW)).toBe(35);
  });

  it("ne décrémente pas le jour exact de l'anniversaire", () => {
    expect(computeAge('1990-06-07', NOW)).toBe(36);
  });
});
