import * as Sentry from '@sentry/node';

// DOIT être importé en tout premier par server.ts : l'auto-instrumentation Sentry patche les
// modules au moment du require. DSN lu dans process.env directement (avant la validation Zod).
// Absent en dev → Sentry reste inactif (aucun envoi, aucun quota consommé).
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    // App E2EE (santé + budget) : ne JAMAIS exfiltrer de PII ni de corps de requête/réponse
    // (chiffrés côté client, mais aussi en clair pour la démo).
    sendDefaultPii: false,
    dataCollection: {
      userInfo: false,
      httpBodies: [],
    },
  });
}
