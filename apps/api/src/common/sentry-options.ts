import type { NodeOptions } from '@sentry/node';

type DataCollection = NonNullable<NodeOptions['dataCollection']>;

/**
 * Ce que Sentry collecte : rien qui identifie un visiteur ou porte ses données. Dès que
 * `dataCollection` est renseigné, Sentry ne part plus de `sendDefaultPii: false` mais de valeurs
 * par défaut qui collectent tout (en-têtes avec l'IP, cookies, paramètres d'URL, variables
 * locales des fonctions) : chaque option est donc tranchée ici. `Required` fait échouer la
 * compilation si une version de Sentry en ajoute une sans qu'on l'ait décidée.
 * Les lignes de code source autour d'une erreur restent : c'est notre code, pas des données.
 */
export const SENTRY_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: false, response: false },
  httpBodies: [],
  queryParams: false,
  genAI: { inputs: false, outputs: false },
  stackFrameVariables: false,
  frameContextLines: 5,
} satisfies Required<DataCollection>;
