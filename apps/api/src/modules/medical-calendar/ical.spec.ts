import { describe, it, expect } from 'vitest';
import { buildIcal, escapeIcal, foldIcalLine, icalTimestamp } from './ical';

const NOW = new Date(2026, 8, 16, 12);

describe('iCal', () => {
  it('escapeIcal retire \r (injection de propriétés VEVENT)', () => {
    expect(escapeIcal('Motif\r\nATTENDEE:mailto:x@y.z')).toBe(
      'Motif\\nATTENDEE:mailto:x@y.z',
    );
  });

  it('escapeIcal échappe ; ,', () => {
    expect(escapeIcal('a;b,c')).toBe('a\\;b\\,c');
  });

  it('buildIcal génère VCALENDAR + VEVENT appointment avec DTSTAMP et TZID', () => {
    const ical = buildIcal(
      [
        {
          id: 'a1',
          date: '2026-06-01',
          time: '10:00',
          practitionerId: 'p1',
          reason: 'Visite',
          outcome: null,
          status: 'scheduled',
        },
      ],
      [{ id: 'p1', name: 'Dr X' }],
      [],
      NOW,
    );
    expect(ical).toContain('BEGIN:VCALENDAR');
    expect(ical).toContain('DTSTART;TZID=Europe/Paris:20260601T100000');
    expect(ical).toContain(`DTSTAMP:${icalTimestamp(NOW)}`);
    expect(ical).toContain('SUMMARY:Dr X - Visite');
    expect(ical).toContain('UID:apt-a1@dashflow');
    expect(ical.endsWith('END:VCALENDAR')).toBe(true);
    expect(ical).not.toContain('X-WR-CALDESC');
  });

  it('médicaments : rupture selon le modèle de stock commun (skipDays, startDate)', () => {
    // 7 comprimés depuis lundi 14/09, pas le week-end → rupture mardi 22/09.
    const ical = buildIcal(
      [],
      [],
      [
        {
          id: 'm1',
          name: 'X',
          dosage: '1 cp',
          quantity: 7,
          dailyRate: '1',
          startDate: '2026-09-14',
          skipDays: [0, 6],
        },
      ],
      NOW,
    );
    expect(ical).toContain('DTSTART;VALUE=DATE:20260922');
    expect(ical).toContain('DESCRIPTION:1 cp - 5 restants');
  });

  it('buildIcal saute les médocs dailyRate<=0', () => {
    const ical = buildIcal(
      [],
      [],
      [
        {
          id: 'm1',
          name: 'X',
          dosage: '1',
          quantity: 10,
          dailyRate: '0',
          startDate: '2026-01-01',
        },
      ],
      NOW,
    );
    expect(ical).not.toContain('med-m1');
  });

  it('lignes E2EE (placeholders) : aucun événement, mais une description qui le dit', () => {
    const ical = buildIcal(
      [
        {
          id: 'a1',
          date: '1970-01-01',
          time: '00:00',
          practitionerId: 'p1',
          reason: null,
          outcome: null,
          status: 'scheduled',
          encryptedData: 'v2.blob',
        },
      ],
      [],
      [
        {
          id: 'm1',
          name: '',
          dosage: '',
          quantity: 0,
          dailyRate: '1',
          startDate: '1970-01-01',
          encryptedData: 'v2.blob',
        },
      ],
      NOW,
    );
    expect(ical).not.toContain('BEGIN:VEVENT');
    expect(ical).toContain('X-WR-CALDESC:2 événement(s) chiffré(s)');
  });

  it('foldIcalLine : 75 octets max par ligne, suite indentée, jamais au milieu d’un caractère UTF-8', () => {
    const long = 'SUMMARY:' + 'é'.repeat(100); // 2 octets par caractère
    const folded = foldIcalLine(long);
    const lines = folded.split('\r\n');
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines)
      expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    for (const l of lines.slice(1)) expect(l.startsWith(' ')).toBe(true);
    // Dépliage : on retrouve la ligne d'origine intacte.
    expect(folded.replace(/\r\n /g, '')).toBe(long);
    expect(foldIcalLine('court')).toBe('court');
  });
});
