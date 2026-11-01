export const environment = {
  production: true,
  // Même origine : Traefik route /api vers l'API (préfixe retiré). Plus de CORS ni de cookie tiers.
  apiUrl: '/api',
  // DSN front public par design (côté navigateur). Projet Sentry « dashflow-frontend ».
  sentryDsn:
    'https://4eeb01b07ee0c8bd0b5054e2cbbe4134@o4511049353723904.ingest.de.sentry.io/4511683907158096',
};
