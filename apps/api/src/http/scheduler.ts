import { CronJob } from 'cron';
import { createLogger } from '../common/logger';
import type { DrizzleDB } from '../db/drizzle.constants';
import type { HttpDeps } from './deps';
import { claimJobSlot, scheduledSlot } from './job-claims';

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

/**
 * Un tick d'horloge : n'exécute la tâche que si cette instance revendique le créneau en base.
 * Plusieurs instances de l'API tournent chacune leur horloge ; sans cette revendication, chaque
 * purge ou réinitialisation de démo partirait autant de fois qu'il y a d'instances.
 */
export async function runScheduledTick(
  db: DrizzleDB,
  name: string,
  run: () => Promise<void>,
  now: Date,
): Promise<void> {
  if (!(await claimJobSlot(db, name, scheduledSlot(now)))) return;
  await run();
}

/** Démarre les tâches ; rend la fonction d'arrêt (à appeler avant de fermer la base). */
export function startScheduledJobs(d: HttpDeps): () => void {
  const jobs = SCHEDULED_JOBS.map((job) =>
    CronJob.from({
      cronTime: job.cron,
      start: true,
      onTick: () =>
        runScheduledTick(d.db, job.name, () => job.run(d), new Date()).catch(
          (err: unknown) =>
            logger.error(
              `Tâche ${job.name} en échec : ${err instanceof Error ? err.message : String(err)}`,
            ),
        ),
    }),
  );
  return () => jobs.forEach((j) => void j.stop());
}
