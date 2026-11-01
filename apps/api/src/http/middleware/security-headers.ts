import { createMiddleware } from 'hono/factory';

/**
 * En-têtes de sécurité, valeur pour valeur ceux que posait Helmet 8 avec la configuration de
 * l'API Nest (CORP cross-origin pour l'avatar en <img>, frameguard deny, CSP par défaut +
 * frame-ancestors 'none'). Statiques : une liste explicite se relit mieux qu'une config.
 */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy':
    "frame-ancestors 'none';default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';img-src 'self' data:;object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests",
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'Origin-Agent-Cluster': '?1',
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-DNS-Prefetch-Control': 'off',
  'X-Download-Options': 'noopen',
  'X-Frame-Options': 'DENY',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'X-XSS-Protection': '0',
};

/** Posés sur TOUTES les réponses, erreurs et 404 compris (après `next`). */
export const securityHeaders = () =>
  createMiddleware(async (c, next) => {
    await next();
    for (const [name, value] of Object.entries(SECURITY_HEADERS))
      c.res.headers.set(name, value);
  });
