import { pgTable, varchar, timestamp } from 'drizzle-orm/pg-core';

/**
 * Dernier créneau revendiqué par tâche planifiée : chaque instance de l'API a sa propre horloge
 * `cron`, et seule celle qui fait avancer `last_slot` exécute la tâche (cf. http/job-claims.ts).
 * Une ligne par tâche : la table ne grossit pas avec le temps.
 */
export const scheduledJobRuns = pgTable('scheduled_job_runs', {
  jobName: varchar('job_name', { length: 64 }).primaryKey(),
  lastSlot: timestamp('last_slot', { withTimezone: true }).notNull(),
});
