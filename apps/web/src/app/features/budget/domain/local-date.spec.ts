import { toLocalIsoDate } from './local-date';

describe('toLocalIsoDate', () => {
  it('Given une Date construite en heure locale When on la formate Then renvoie le jour LOCAL (pas UTC)', () => {
    const localMidnightIsh = new Date(2026, 6, 4, 0, 30);

    expect(toLocalIsoDate(localMidnightIsh)).toBe('2026-07-04');
  });

  it('Given une Date en fin de journée locale When on la formate Then reste sur le jour local', () => {
    const lateEvening = new Date(2026, 6, 4, 23, 30);

    expect(toLocalIsoDate(lateEvening)).toBe('2026-07-04');
  });

  it.each([
    { d: new Date(2026, 0, 1, 12, 0), expected: '2026-01-01' },
    { d: new Date(2026, 8, 9, 8, 0), expected: '2026-09-09' },
    { d: new Date(2026, 11, 31, 18, 45), expected: '2026-12-31' },
    { d: new Date(2027, 2, 5, 6, 0), expected: '2027-03-05' },
  ])('Given $expected When on formate Then zéro-padde mois et jour', ({ d, expected }) => {
    expect(toLocalIsoDate(d)).toBe(expected);
  });
});
