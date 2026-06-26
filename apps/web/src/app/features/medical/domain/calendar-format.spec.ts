import { describe, expect, it } from 'vitest';
import {
  allDaysExcept,
  escapeIcs,
  formatGoogleDateOnly,
  toIcsDateOnly,
  toIcsDateTime,
} from './calendar-format';

describe('calendar-format', () => {
  describe('toIcsDateTime', () => {
    it('given a date and time, when formatted, then yields YYYYMMDDTHHMM00', () => {
      expect(toIcsDateTime('2026-03-08', '09:30')).toBe('20260308T093000');
    });

    it('given an offset in minutes, when formatted, then shifts the time', () => {
      expect(toIcsDateTime('2026-03-08', '09:30', 60)).toBe('20260308T103000');
    });
  });

  describe('toIcsDateOnly', () => {
    it('given a Date, when formatted, then yields YYYYMMDD', () => {
      expect(toIcsDateOnly(new Date(2026, 2, 8))).toBe('20260308');
    });
  });

  describe('formatGoogleDateOnly', () => {
    it('given a Date, when formatted, then yields a UTC YYYYMMDD', () => {
      expect(formatGoogleDateOnly(new Date('2026-03-08T00:00:00Z'))).toBe('20260308');
    });
  });

  describe('escapeIcs', () => {
    it('escapes backslash, semicolon and comma', () => {
      expect(escapeIcs('a;b,c\\d')).toBe('a\\;b\\,c\\\\d');
    });

    it('escapes newlines as \\n', () => {
      expect(escapeIcs('line1\nline2')).toBe('line1\\nline2');
    });
  });

  describe('allDaysExcept', () => {
    it('given no skipped days, returns the full week', () => {
      expect(allDaysExcept([])).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it('given skipped days, excludes exactly those', () => {
      expect(allDaysExcept([0, 6])).toEqual([1, 2, 3, 4, 5]);
    });
  });
});
