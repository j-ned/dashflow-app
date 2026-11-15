import { lt, sql } from 'drizzle-orm';
import type { DrizzleDB } from '../db/drizzle.constants';
import { scheduledJobRuns } from '../db/schema';

const MINUTE_MS = 60_000;

/**
 * Créneau planifié d'un tick : la minute la plus proche. Les tâches tombent sur des minutes
 * pleines, et les horloges de deux instances (NTP) divergent de quelques millisecondes : arrondir
 * plutôt que tronquer évite qu'un tick à 03:59:59.950 et un autre à 04:00:00.080 visent deux
 * créneaux différents.
 */
export function scheduledSlot(at: Date): Date {
  return new Date(Math.round(at.getTime() / MINUTE_MS) * MINUTE_MS);
}

/**
 * Revendique `slot` pour la tâche `jobName` : `true` pour une seule instance par créneau, `false`
 * pour les autres et pour tout créneau déjà dépassé. Atomique en une requête (la ligne est
 * verrouillée par l'upsert), donc sans transaction ni verrou de session : compatible avec un
 * pooler PgBouncer en mode transaction.
 */
export async function claimJobSlot(
  db: DrizzleDB,
  jobName: string,
  slot: Date,
): Promise<boolean> {
  const claimed = await db
    .insert(scheduledJobRuns)
    .values({ jobName, lastSlot: slot })
    .onConflictDoUpdate({
      target: scheduledJobRuns.jobName,
      set: { lastSlot: sql`excluded.last_slot` },
      setWhere: lt(scheduledJobRuns.lastSlot, sql`excluded.last_slot`),
    })
    .returning({ jobName: scheduledJobRuns.jobName });
  return claimed.length === 1;
}
