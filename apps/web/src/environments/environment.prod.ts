export const environment = {
  production: true,
  // Même origine : Traefik route /api vers l'API (préfixe retiré). Plus de CORS ni de cookie tiers.
  apiUrl: '/api',
  // DSN front public par design (côté navigateur). Projet Sentry « dashflow-app-angular ».
  sentryDsn:
    'https://7dcb8af89de273e64c750618174495f7@o4511049353723904.ingest.de.sentry.io/4512436840300624',
};
