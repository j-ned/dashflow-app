import * as Sentry from '@sentry/node';
import { SENTRY_DATA_COLLECTION } from './common/sentry-options';
import { scrubSentryEvent } from './common/sentry-scrub';

// DOIT être importé en tout premier par server.ts : l'auto-instrumentation Sentry patche les
// modules au moment du require. DSN lu dans process.env directement (avant la validation Zod).
// Absent en dev → Sentry reste inactif (aucun envoi, aucun quota consommé).
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    // Commit déployé (image Docker, cf. apps/api/Dockerfile) : relie chaque erreur à sa version.
    ...(process.env.SENTRY_RELEASE
      ? { release: process.env.SENTRY_RELEASE }
      : {}),
    // App E2EE (santé + budget) : ne JAMAIS exfiltrer de PII ni de corps de requête/réponse
    // (chiffrés côté client, mais aussi en clair pour la démo). Cf. common/sentry-options.ts.
    sendDefaultPii: false,
    dataCollection: SENTRY_DATA_COLLECTION,
    // Valeurs liées des requêtes SQL retirées de chaque événement (cf. sentry-scrub.ts).
    beforeSend: scrubSentryEvent,
  });
}
