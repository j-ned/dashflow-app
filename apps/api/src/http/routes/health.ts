import { Hono } from 'hono';
import { timingSafeEqual } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Env } from '../../config/env.schema';
import type { DrizzleDB } from '../../db/drizzle.constants';
import { NotFoundError, ServiceUnavailableError } from '../../common/errors';
import type { AppEnv } from '../types';

function sameToken(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function healthRoutes(deps: {
  db: DrizzleDB;
  env: Pick<Env, 'HEALTH_TOKEN'>;
}) {
  return (
    new Hono<AppEnv>()
      // Sonde de VIE (HEALTHCHECK Docker) : publique, sans détail et sans toucher la base. Elle ne
      // doit pas dépendre de Postgres : une base en panne ferait redémarrer l'API en boucle.
      .get('/', (c) => c.json({ ok: true as const }))
      // État de la base, pour un monitoring : réservé à qui présente HEALTH_TOKEN. Sans jeton
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
        return c.json({ ok: true as const, db: true as const });
      })
  );
}
