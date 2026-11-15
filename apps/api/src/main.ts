// IMPORTANT : en tout premier — initialise Sentry avant tout autre import (auto-instrumentation).
import './instrument';
import { serve } from '@hono/node-server';
import { envSchema } from './config/env.schema';
import { createLogger } from './common/logger';
import { createApp } from './http/app';
import { createDeps } from './http/deps';
import { startScheduledJobs } from './http/scheduler';
import { describeError } from './common/describe-error';

const logger = createLogger('HttpServer');

// .env local en dev ; les variables déjà présentes dans l'environnement priment.
try {
  process.loadEnvFile();
} catch {
  // Pas de .env : configuration fournie par l'environnement (prod, CI).
}

const env = envSchema.parse(process.env);
const { deps, connect, close } = createDeps(env);

function start(): void {
  const stopJobs = startScheduledJobs(deps);
  const server = serve(
    { fetch: createApp(deps).fetch, port: env.PORT },
    (info) => logger.log(`API Hono à l'écoute sur le port ${info.port}`),
  );

  // Arrêt propre : sous Docker le processus n° 1 doit sortir lui-même sur SIGTERM, sinon il reste
  // en vie jusqu'au SIGKILL (10 s, code 137) à chaque déploiement.
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      stopJobs();
      server.close(() => {
        void close().finally(() => process.exit(0));
      });
    });
  }
}

// L'API n'écoute qu'une fois Redis joint (si REDIS_URL est réglée) : sans lui, chaque requête
// échouerait. La connexion réessaie d'elle-même ; un échec définitif arrête le processus, que
// Docker relance.
connect().then(start, (err: unknown) => {
  logger.error(`Démarrage impossible : ${describeError(err)}`);
  process.exit(1);
});
