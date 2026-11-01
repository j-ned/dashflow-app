// IMPORTANT : en tout premier — initialise Sentry avant tout autre import (auto-instrumentation).
import './instrument';
import { serve } from '@hono/node-server';
import { envSchema } from './config/env.schema';
import { createLogger } from './common/logger';
import { createApp } from './http/app';
import { createDeps } from './http/deps';
import { startScheduledJobs } from './http/scheduler';

const logger = createLogger('HttpServer');

// .env local en dev ; les variables déjà présentes dans l'environnement priment.
try {
  process.loadEnvFile();
} catch {
  // Pas de .env : configuration fournie par l'environnement (prod, CI).
}

const env = envSchema.parse(process.env);
const { deps, close } = createDeps(env);
const stopJobs = startScheduledJobs(deps);
const server = serve({ fetch: createApp(deps).fetch, port: env.PORT }, (info) =>
  logger.log(`API Hono à l'écoute sur le port ${info.port}`),
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
