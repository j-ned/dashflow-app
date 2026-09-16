/**
 * Date du jour au format `YYYY-MM-DD` (colonnes `date` Postgres), dans le fuseau des
 * utilisateurs. Avant : `toISOString()` = UTC → entre 0 h et 2 h (heure de Paris) une opération
 * sans date explicite tombait la veille, parfois le mois précédent.
 */
export const APP_TIMEZONE = 'Europe/Paris';

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const today = (now: Date = new Date()): string => fmt.format(now);
