/**
 * Formatage des dates et textes pour l'export calendrier (ICS + Google Calendar).
 * Fonctions pures, sans dépendance Angular — testables sans TestBed.
 */

/** Date+heure locale au format compact Google Calendar (`YYYYMMDDTHHMMSSZ`-like, sans Z). */
export function toGoogleDate(date: string, time: string, addMinutes = 0): string {
  const d = new Date(`${date}T${time}`);
  if (addMinutes) d.setMinutes(d.getMinutes() + addMinutes);
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** Date seule au format compact Google Calendar (`YYYYMMDD`). */
export function formatGoogleDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

/** Date+heure locale au format ICS `DTSTART` (`YYYYMMDDTHHMM00`). */
export function toIcsDateTime(date: string, time: string, addMinutes = 0): string {
  const d = new Date(`${date}T${time}`);
  if (addMinutes) d.setMinutes(d.getMinutes() + addMinutes);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

/** Date seule au format ICS `VALUE=DATE` (`YYYYMMDD`). */
export function toIcsDateOnly(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/** Échappe les caractères réservés ICS (`\ ; ,` et retours ligne). */
export function escapeIcs(s: string): string {
  return s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
}

/** Indices de jours [0..6] (dimanche→samedi) absents de `skipDays`. */
export function allDaysExcept(skipDays: readonly number[]): number[] {
  return [0, 1, 2, 3, 4, 5, 6].filter((d) => !skipDays.includes(d));
}
