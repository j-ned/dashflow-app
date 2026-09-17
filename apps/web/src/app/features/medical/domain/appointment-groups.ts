import { Appointment } from './models/appointment.model';

export type AppointmentGroupKey = 'thisWeek' | 'later' | 'past';

export type AppointmentGroup = {
  readonly key: AppointmentGroupKey;
  readonly appointments: readonly Appointment[];
};

const THIS_WEEK_DAYS = 7;
const GROUP_ORDER: readonly AppointmentGroupKey[] = ['thisWeek', 'later', 'past'];

/** Date locale au format des rendez-vous (`YYYY-MM-DD`), sans passage par l'UTC. */
export function localIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return localIsoDate(new Date(year, month - 1, day + days));
}

const chronological = (a: Appointment, b: Appointment): number =>
  `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`);

/**
 * Range les rendez-vous comme on les cherche : d'abord les 7 jours qui viennent, puis le reste à
 * venir (du plus proche au plus lointain), enfin les passés (du plus récent au plus ancien).
 * Les groupes vides sont omis.
 */
export function groupAppointments(
  appointments: readonly Appointment[],
  today: string,
): AppointmentGroup[] {
  const weekEnd = addDays(today, THIS_WEEK_DAYS);
  const buckets: Record<AppointmentGroupKey, Appointment[]> = { thisWeek: [], later: [], past: [] };
  for (const appointment of appointments) {
    if (appointment.date < today) buckets.past.push(appointment);
    else if (appointment.date < weekEnd) buckets.thisWeek.push(appointment);
    else buckets.later.push(appointment);
  }
  buckets.thisWeek.sort(chronological);
  buckets.later.sort(chronological);
  buckets.past.sort((a, b) => chronological(b, a));
  return GROUP_ORDER.filter((key) => buckets[key].length > 0).map((key) => ({
    key,
    appointments: buckets[key],
  }));
}
