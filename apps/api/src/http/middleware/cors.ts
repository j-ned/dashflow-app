import { cors } from 'hono/cors';
import { createMiddleware } from 'hono/factory';
import type { Env } from '../../config/env.schema';
import { NEXT_CURSOR_HEADER } from '../../common/crud/keyset';

/**
 * Front servi sur une autre origine : cookies cross-origin (credentials) pour les seules
 * origines de CORS_ORIGIN. En-têtes demandés reflétés au preflight, comme le paquet `cors`.
 */
export function corsPolicy(config: Pick<Env, 'CORS_ORIGIN'>) {
  const allowed = new Set(
    config.CORS_ORIGIN.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  );
  const policy = cors({
    origin: (origin) => (allowed.has(origin) ? origin : null),
    credentials: true,
    allowMethods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    // Pagination par curseur : le front doit pouvoir lire l'en-tête de page suivante.
    exposeHeaders: [NEXT_CURSOR_HEADER],
  });
  return createMiddleware(async (c, next) => {
    const response = await policy(c, next);
    // Preflight : la réponse dépend TOUJOURS des en-têtes demandés (reflétés), même absents —
    // hono/cors ne le déclare que s'ils sont présents. Un cache partagé doit en tenir compte.
    if (response && c.req.header('access-control-request-method')) {
      const vary = response.headers.get('vary') ?? '';
      if (!/access-control-request-headers/i.test(vary))
        response.headers.append('Vary', 'Access-Control-Request-Headers');
    }
    return response;
  });
}
