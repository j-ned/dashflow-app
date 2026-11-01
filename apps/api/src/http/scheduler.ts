import { CronJob } from 'cron';
import { createLogger } from '../common/logger';
import type { HttpDeps } from './deps';

const logger = createLogger('Scheduler');

/**
 * Tâches de fond. Hors Vercel (Docker, local) : horloge interne (startScheduledJobs), mêmes
 * expressions que les CronExpression de @nestjs/schedule (même bibliothèque `cron`, fuseau du
 * serveur). Sur Vercel : Vercel Cron appelle /api/cron/<path> (cf. routes/cron.ts, vercel.json).
 * Une erreur est journalisée, jamais propagée : elle ne doit ni arrêter l'horloge ni le processus.
 */
export type ScheduledJob = {
  readonly name: string;
  /** Segment d'URL de la route /cron/:job. */
  readonly path: string;
  readonly cron: string;
  readonly run: (d: HttpDeps) => Promise<void>;
};

export const SCHEDULED_JOBS: readonly ScheduledJob[] = [
  {
    name: 'purgeOldSecurityEvents',
    path: 'purge-security-events',
    cron: '0 04 * * *',
    run: (d) => d.securityEvents.purgeOld(),
  },
  {
    name: 'purgeStaleUnverifiedAccounts',
    path: 'purge-unverified-accounts',
    cron: '0 05 * * *',
    run: (d) => d.admin.purgeStaleUnverified(),
  },
  // No-op si DEMO_ENABLED=false (vérifié par DemoService).
  {
    name: 'resetDemoAccount',
    path: 'reset-demo',
    cron: '0 0-23/6 * * *',
    run: (d) => d.demo.scheduledReset(),
  },
];

/** Démarre les tâches ; rend la fonction d'arrêt (à appeler avant de fermer la base). */
export function startScheduledJobs(d: HttpDeps): () => void {
  const jobs = SCHEDULED_JOBS.map((job) =>
    CronJob.from({
      cronTime: job.cron,
      start: true,
      onTick: () =>
        job
          .run(d)
          .catch((err: unknown) =>
            logger.error(
              `Tâche ${job.name} en échec : ${err instanceof Error ? err.message : String(err)}`,
            ),
          ),
    }),
  );
  return () => jobs.forEach((j) => void j.stop());
}
