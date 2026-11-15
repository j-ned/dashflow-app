import { Hono } from 'hono';
import { timingSafeEqual } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Env } from '../../config/env.schema';
import type { DrizzleDB } from '../../db/drizzle.constants';
import { NotFoundError, ServiceUnavailableError } from '../../common/errors';
import { createLogger } from '../../common/logger';
import type { RateLimiter } from '../rate-limit-store';
import type { AppEnv } from '../types';
import { describeError } from '../../common/describe-error';

const logger = createLogger('Health');

/** Au-delà, la sonde répond 503 plutôt que de rester suspendue à un Redis figé. */
const REDIS_PING_TIMEOUT_MS = 2_000;

/** Rejette si `promise` ne s'est pas conclue avant `ms`. */
async function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`délai de ${ms} ms dépassé`)),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function sameToken(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function healthRoutes(deps: {
  db: DrizzleDB;
  env: Pick<Env, 'HEALTH_TOKEN'>;
  rateLimits: Pick<RateLimiter, 'ping'>;
}) {
  return (
    new Hono<AppEnv>()
      // Sonde de VIE (HEALTHCHECK Docker) : publique, sans détail et sans toucher la base. Elle ne
      // doit pas dépendre de Postgres : une base en panne ferait redémarrer l'API en boucle.
      .get('/', (c) => c.json({ ok: true as const }))
      // État de la base et de Redis (s'il est utilisé), pour un monitoring : réservé à qui présente
      // HEALTH_TOKEN. Sans jeton
      // configuré, ou avec un mauvais jeton, la route n'existe pas (404) plutôt que d'avouer
      // qu'elle est protégée.
      .get('/ready', async (c) => {
        const expected = deps.env.HEALTH_TOKEN;
        const presented = c.req.header('x-health-token');
        if (!expected || !presented || !sameToken(presented, expected))
          throw new NotFoundError('Non trouvé');
        try {
          await deps.db.execute(sql`select 1`);
        } catch {
          throw new ServiceUnavailableError('Base de données injoignable');
        }
        const ping = deps.rateLimits.ping?.bind(deps.rateLimits);
        if (!ping) return c.json({ ok: true as const, db: true as const });
        // Redis en panne : chaque requête échoue alors que la sonde de vie reste à 200. Seule
        // cette route le voit.
        try {
          await within(ping(), REDIS_PING_TIMEOUT_MS);
        } catch (err) {
          logger.error(`Sonde : Redis injoignable (${describeError(err)})`);
          throw new ServiceUnavailableError('Redis injoignable');
        }
        return c.json({
          ok: true as const,
          db: true as const,
          redis: true as const,
        });
      })
  );
}
