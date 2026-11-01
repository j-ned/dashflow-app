export const environment = {
  production: false,
  // Même origine qu'en prod : le serveur de dev relaie /api vers l'API (proxy.conf.json).
  apiUrl: '/api',
  // Vide en dev : Sentry n'est pas initialisé (aucun envoi, zéro quota consommé).
  sentryDsn: '',
};
