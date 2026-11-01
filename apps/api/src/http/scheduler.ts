import { CronJob } from 'cron';
import { createLogger } from '../common/logger';
import type { HttpDeps } from './deps';

const logger = createLogger('Scheduler');

/**
 * Tâches de fond, mêmes expressions que les CronExpression de @nestjs/schedule (même
 * bibliothèque `cron` dessous, fuseau du serveur). Une erreur est journalisée, jamais propagée :
 * elle ne doit ni arrêter l'horloge ni le processus.
 */
export const SCHEDULED_JOBS: readonly {
  name: string;
  cron: string;
  run: (d: HttpDeps) => Promise<void>;
}[] = [
  {
    name: 'purgeOldSecurityEvents',
    cron: '0 04 * * *',
    run: (d) => d.securityEvents.purgeOld(),
  },
  {
    name: 'purgeStaleUnverifiedAccounts',
    cron: '0 05 * * *',
    run: (d) => d.admin.purgeStaleUnverified(),
  },
  // No-op si DEMO_ENABLED=false (vérifié par DemoService).
  {
    name: 'resetDemoAccount',
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
