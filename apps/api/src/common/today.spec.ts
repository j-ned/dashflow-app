import { describe, it, expect } from 'vitest';
import { today } from './today';

describe('today()', () => {
  it('format YYYY-MM-DD', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("à 23 h 30 UTC un 31 août, c'est déjà le 1er septembre à Paris (UTC+2)", () => {
    expect(today(new Date('2026-08-31T23:30:00Z'))).toBe('2026-09-01');
  });
  it('à 22 h UTC en hiver (UTC+1), on est encore le même jour', () => {
    expect(today(new Date('2026-01-15T22:00:00Z'))).toBe('2026-01-15');
  });
});
