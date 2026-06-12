/** Date du jour au format `YYYY-MM-DD` (colonnes `date` Postgres). */
export const today = (): string => new Date().toISOString().slice(0, 10);
