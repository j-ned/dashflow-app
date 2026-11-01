import { Hono } from 'hono';
import { timingSafeEqual } from 'node:crypto';
import { NotFoundError } from '../../common/errors';
import { createLogger } from '../../common/logger';
import type { HttpDeps } from '../deps';
import { SCHEDULED_JOBS } from '../scheduler';
import type { AppEnv } from '../types';

const logger = createLogger('Cron');

function bearerMatches(header: string | undefined, secret: string): boolean {
  const presented = Buffer.from(header ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return (
    presented.length === expected.length && timingSafeEqual(presented, expected)
  );
}

/**
 * Déclenchement des tâches de fond par Vercel Cron (GET + `Authorization: Bearer CRON_SECRET`).
 * Sans CRON_SECRET configuré, ou avec un mauvais jeton, la route n'existe pas (404) : elle
 * n'avoue pas qu'elle est protégée, comme /health/ready.
 */
export function cronRoutes(d: HttpDeps) {
  return new Hono<AppEnv>().get('/:job', async (c) => {
    const secret = d.env.CRON_SECRET;
    const job = SCHEDULED_JOBS.find((j) => j.path === c.req.param('job'));
    if (
      !secret ||
      !job ||
      !bearerMatches(c.req.header('authorization'), secret)
    )
      throw new NotFoundError('Non trouvé');
    const started = Date.now();
    await job.run(d);
    logger.log(`${job.name} terminée en ${Date.now() - started} ms`);
    return c.json({ ok: true as const, job: job.path });
  });
}
