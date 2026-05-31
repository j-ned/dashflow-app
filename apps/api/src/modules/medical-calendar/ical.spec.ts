import { describe, it, expect } from 'vitest';
import { buildIcal, escapeIcal } from './ical';

describe('iCal', () => {
  it('escapeIcal échappe ; ,', () => { expect(escapeIcal('a;b,c')).toBe('a\\;b\\,c'); });
  it('buildIcal génère VCALENDAR + VEVENT appointment', () => {
    const ical = buildIcal(
      [{ id: 'a1', date: '2026-06-01', time: '10:00', practitionerId: 'p1', reason: 'Visite', outcome: null, status: 'scheduled' }],
      [{ id: 'p1', name: 'Dr X' }], [],
    );
    expect(ical).toContain('BEGIN:VCALENDAR');
    expect(ical).toContain('DTSTART:20260601T100000');
    expect(ical).toContain('SUMMARY:Dr X - Visite');
    expect(ical).toContain('UID:apt-a1@dashflow');
    expect(ical.endsWith('END:VCALENDAR')).toBe(true);
  });
  it('buildIcal saute les médocs dailyRate<=0', () => {
    const ical = buildIcal([], [], [{ id: 'm1', name: 'X', dosage: '1', quantity: 10, dailyRate: '0', startDate: '2026-01-01' }]);
    expect(ical).not.toContain('med-m1');
  });
});
