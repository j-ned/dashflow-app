import { computeMedicationStock } from '../medications/medication-stock';

export function escapeIcal(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n');
}

export interface IcalAppointment {
  id: string;
  date: string;
  time: string;
  practitionerId: string;
  reason: string | null;
  outcome: string | null;
  status: string;
  encryptedData?: string | null;
}
export interface IcalMedication {
  id: string;
  name: string;
  dosage: string;
  quantity: number;
  dailyRate: string;
  startDate: string;
  skipDays?: unknown;
  alertDaysBefore?: number;
  encryptedData?: string | null;
}

/** Fuseau des utilisateurs : une heure de RDV « 10:00 » est une heure de Paris, pas flottante. */
export const ICAL_TZID = 'Europe/Paris';
const LINE_MAX_OCTETS = 75;

/** DTSTAMP obligatoire (RFC 5545 §3.8.7.2) : instant UTC de génération. */
export function icalTimestamp(now = new Date()): string {
  return now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Pliage RFC 5545 §3.1 : lignes de 75 octets maximum (UTF-8), suite indentée d'un espace.
 * On coupe entre caractères, jamais au milieu d'une séquence multi-octets.
 */
export function foldIcalLine(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = '';
  let currentBytes = 0;
  for (const ch of line) {
    const bytes = encoder.encode(ch).length;
    const limit = out.length === 0 ? LINE_MAX_OCTETS : LINE_MAX_OCTETS - 1;
    if (currentBytes + bytes > limit) {
      out.push(current);
      current = '';
      currentBytes = 0;
    }
    current += ch;
    currentBytes += bytes;
  }
  out.push(current);
  return out.map((l, i) => (i === 0 ? l : ` ${l}`)).join('\r\n');
}

/** Ligne E2EE : la date est un placeholder, l'événement n'a aucun sens hors du client. */
const isPlaceholder = (row: { encryptedData?: string | null }): boolean =>
  !!row.encryptedData;

export function buildIcal(
  appointments: IcalAppointment[],
  practitioners: { id: string; name: string }[],
  medications: IcalMedication[],
  now = new Date(),
): string {
  const practMap = new Map(practitioners.map((p) => [p.id, p.name]));
  const stamp = icalTimestamp(now);
  const encryptedCount =
    appointments.filter(isPlaceholder).length +
    medications.filter(isPlaceholder).length;
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DashFlow//Medical Calendar//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:DashFlow Medical',
    `X-WR-TIMEZONE:${ICAL_TZID}`,
  ];
  if (encryptedCount > 0) {
    // Le flux public ne peut pas publier des données chiffrées de bout en bout : on le dit,
    // plutôt que d'exporter des événements datés de 1970.
    lines.push(
      `X-WR-CALDESC:${escapeIcal(
        `${encryptedCount} événement(s) chiffré(s) de bout en bout non publiable(s) ici. Exportez le calendrier depuis l'application.`,
      )}`,
    );
  }
  for (const apt of appointments) {
    if (isPlaceholder(apt)) continue;
    const dateStr = apt.date.replace(/-/g, '');
    const timeStr = apt.time.replace(':', '') + '00';
    const practName = practMap.get(apt.practitionerId) ?? 'Praticien';
    const summary = apt.reason ? `${practName} - ${apt.reason}` : practName;
    lines.push(
      'BEGIN:VEVENT',
      `UID:apt-${apt.id}@dashflow`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${ICAL_TZID}:${dateStr}T${timeStr}`,
      `SUMMARY:${escapeIcal(summary)}`,
    );
    if (apt.outcome) lines.push(`DESCRIPTION:${escapeIcal(apt.outcome)}`);
    lines.push(
      `STATUS:${apt.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
      'END:VEVENT',
    );
  }
  for (const med of medications) {
    if (isPlaceholder(med)) continue;
    const stock = computeMedicationStock(
      {
        ...med,
        skipDays: med.skipDays ?? [],
        alertDaysBefore: med.alertDaysBefore ?? 7,
      },
      now,
    );
    if (!stock.runOutDate) continue;
    lines.push(
      'BEGIN:VEVENT',
      `UID:med-${med.id}@dashflow`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${stock.runOutDate.replace(/-/g, '')}`,
      `SUMMARY:${escapeIcal(`Renouveler: ${med.name}`)}`,
      `DESCRIPTION:${escapeIcal(`${med.dosage} - ${stock.remainingQuantity} restants`)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldIcalLine).join('\r\n');
}
