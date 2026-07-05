import * as Sentry from '@sentry/nestjs';

// DOIT être importé en tout premier dans main.ts (avant NestFactory et les autres modules) :
// l'auto-instrumentation Sentry patche les modules au moment du require.
//
// DSN lu depuis process.env DIRECTEMENT (ce fichier s'exécute avant le ConfigModule Nest, donc
// avant la validation Zod / le chargement .env). En prod il vient de l'env Dokploy ; absent en
// dev → Sentry reste inactif (aucun envoi, aucun quota consommé).
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
