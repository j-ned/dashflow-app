import { Hono } from 'hono';
import type { HttpDeps } from './deps';
import { installErrorHandling } from './error-handling';
import { defaultBodyLimit } from './middleware/body-limit';
import { clientIp } from './middleware/client-ip';
import { corsPolicy } from './middleware/cors';
import { rateLimit } from './middleware/rate-limit';
import { securityHeaders } from './middleware/security-headers';
import { authRoutes } from './routes/auth';
import { accountTransactionsRoutes } from './routes/account-transactions';
import { adminRoutes } from './routes/admin';
import { bankAccountsRoutes } from './routes/bank-accounts';
import { documentsRoutes } from './routes/documents';
import { envelopesRoutes } from './routes/envelopes';
import { loansRoutes } from './routes/loans';
import { medicationsRoutes } from './routes/medications';
import { membersRoutes } from './routes/members';
import { prescriptionsRoutes } from './routes/prescriptions';
import { recurringEntriesRoutes } from './routes/recurring-entries';
import { salaryArchivesRoutes } from './routes/salary-archives';
import { cronRoutes } from './routes/cron';
import { healthRoutes } from './routes/health';
import { oauthRoutes } from './routes/oauth';
import { appointmentsRoutes } from './routes/appointments';
import { patientsRoutes } from './routes/patients';
import { practitionersRoutes } from './routes/practitioners';
import { remindersRoutes } from './routes/reminders';
import type { AppEnv } from './types';

/**
 * Socle HTTP commun à toutes les routes, dans l'ordre : en-têtes de sécurité (posés sur toute
 * réponse), CORS (le preflight répond ici, sans throttling), IP client, throttling par route,
 * plafond de corps. Les groupes de routes métier s'y montent avec `app.route()`.
 */
export function createApp(
  deps: HttpDeps,
  /** Préfixe public : `/api` sur Vercel, où la fonction reçoit le chemin complet. */
  opts: { basePath?: string } = {},
): Hono<AppEnv> {
  const app = opts.basePath
    ? new Hono<AppEnv>().basePath(opts.basePath)
    : new Hono<AppEnv>();
  app.use(securityHeaders());
  app.use(corsPolicy(deps.env));
  app.use(clientIp());
  app.use(rateLimit(deps.rateLimits));
  app.use(defaultBodyLimit());

  app.route('/health', healthRoutes(deps));
  app.route('/cron', cronRoutes(deps));
  app.route('/auth/oauth/google', oauthRoutes(deps));
  app.route('/auth', authRoutes(deps));
  app.route('/patients', patientsRoutes(deps));
  app.route('/practitioners', practitionersRoutes(deps));
  app.route('/appointments', appointmentsRoutes(deps));
  app.route('/reminders', remindersRoutes(deps));
  app.route('/admin', adminRoutes(deps));
  app.route('/bank-accounts', bankAccountsRoutes(deps));
  app.route('/documents', documentsRoutes(deps));
  app.route('/envelopes', envelopesRoutes(deps));
  app.route('/loans', loansRoutes(deps));
  app.route('/medications', medicationsRoutes(deps));
  app.route('/members', membersRoutes(deps));
  app.route('/prescriptions', prescriptionsRoutes(deps));
  app.route('/recurring-entries', recurringEntriesRoutes(deps));
  app.route('/salary-archives', salaryArchivesRoutes(deps));
  // @Controller() sans préfixe : /transactions/* et /bank-accounts/:accountId/transactions.
  app.route('/', accountTransactionsRoutes(deps));

  installErrorHandling(app);
  return app;
}
