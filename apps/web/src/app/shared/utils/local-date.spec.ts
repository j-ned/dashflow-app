import { toLocalIsoDate, todayIso } from './local-date';

describe('local-date', () => {
  afterEach(() => vi.useRealTimers());

  it('formate la date civile locale, pas la date UTC', () => {
    // 00:30 heure locale : toISOString() donnerait la veille dans tout fuseau à l'est de Greenwich.
    const justAfterMidnight = new Date(2026, 2, 5, 0, 30);
    expect(toLocalIsoDate(justAfterMidnight)).toBe('2026-03-05');
  });

  it('complète le mois et le jour sur deux chiffres', () => {
    expect(toLocalIsoDate(new Date(2026, 0, 9, 12))).toBe('2026-01-09');
  });

  it("todayIso suit l'horloge locale", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 19, 0, 15));
    expect(todayIso()).toBe('2026-09-19');
  });
});
