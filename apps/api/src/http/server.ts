// IMPORTANT : en tout premier — initialise Sentry avant tout autre import (auto-instrumentation).
import './instrument';
import { serve } from '@hono/node-server';
import { envSchema } from '../config/env.schema';
import { createLogger } from '../common/logger';
import { createApp } from './app';
import { createDeps } from './deps';

const logger = createLogger('HttpServer');

// .env local en dev (comme ConfigModule) ; les variables déjà présentes priment.
try {
  process.loadEnvFile();
} catch {
  // Pas de .env : configuration fournie par l'environnement (prod, CI).
}

const env = envSchema.parse(process.env);
const { deps, close } = createDeps(env);
const server = serve({ fetch: createApp(deps).fetch, port: env.PORT }, (info) =>
  logger.log(`API Hono à l'écoute sur le port ${info.port}`),
);

// Arrêt propre : sous Docker le processus n° 1 doit sortir lui-même sur SIGTERM, sinon il reste
// en vie jusqu'au SIGKILL (10 s, code 137) à chaque déploiement.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    server.close(() => {
      void close().finally(() => process.exit(0));
    });
  });
}
