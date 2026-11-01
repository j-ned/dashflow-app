import { Hono } from 'hono';
import type { HttpDeps } from './deps';
import { installErrorHandling } from './error-handling';
import { defaultBodyLimit } from './middleware/body-limit';
import { clientIp } from './middleware/client-ip';
import { corsPolicy } from './middleware/cors';
import { rateLimit } from './middleware/rate-limit';
import { securityHeaders } from './middleware/security-headers';
import { healthRoutes } from './routes/health';
import type { AppEnv } from './types';

/**
 * Socle HTTP commun à toutes les routes, dans l'ordre : en-têtes de sécurité (posés sur toute
 * réponse), CORS (le preflight répond ici, sans throttling), IP client, throttling par route,
 * plafond de corps. Les groupes de routes métier s'y montent avec `app.route()`.
 */
export function createApp(deps: HttpDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use(securityHeaders());
  app.use(corsPolicy(deps.env));
  app.use(clientIp());
  app.use(rateLimit(deps.rateLimits));
  app.use(defaultBodyLimit());

  app.route('/health', healthRoutes(deps));

  installErrorHandling(app);
  return app;
}
