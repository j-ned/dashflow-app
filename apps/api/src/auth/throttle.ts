/** Limite stricte partagée par les routes d'auth sensibles : 10 requêtes / 15 min. */
export const STRICT_THROTTLE = { default: { limit: 10, ttl: 900_000 } };
