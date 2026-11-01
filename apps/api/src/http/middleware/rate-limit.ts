import type { Context, MiddlewareHandler } from 'hono';
import { createMiddleware } from 'hono/factory';
import { matchedRoutes } from 'hono/route';
import { TooManyRequestsError } from '../errors';
import type { RateLimitStore, ThrottleRule } from '../rate-limit-store';
import type { AppEnv } from '../types';

/**
 * Plafond par défaut, par route et par IP. 100 / 15 min était atteignable par un foyer actif
 * derrière une même IP, surtout depuis que le front suit la pagination ; 1000 reste une borne
 * anti-abus, pas une limite d'usage.
 */
export const DEFAULT_THROTTLE: ThrottleRule = { limit: 1000, ttlMs: 900_000 };
/** Routes d'auth sensibles : 10 requêtes / 15 min. */
export const STRICT_THROTTLE: ThrottleRule = { limit: 10, ttlMs: 900_000 };

/** Règle propre à une route, posée par `throttle()` : remplace DEFAULT_THROTTLE. */
const routeRules = new WeakMap<MiddlewareHandler, ThrottleRule>();

/** Route réellement atteinte (méthode + motif), ou `undefined` si seule la 404 répondra. */
function matchedRoute(c: Context): string | undefined {
  const route = matchedRoutes(c).findLast((r) => r.method !== 'ALL');
  return route ? `${route.method} ${route.path}` : undefined;
}

function check(
  c: Context,
  store: RateLimitStore,
  key: string,
  rule: ThrottleRule,
): void {
  const r = store.increment(key, rule);
  if (r.isBlocked) {
    c.header('Retry-After', String(r.timeToBlockExpire));
    throw new TooManyRequestsError();
  }
  c.header('X-RateLimit-Limit', String(rule.limit));
  c.header(
    'X-RateLimit-Remaining',
    String(Math.max(0, rule.limit - r.totalHits)),
  );
  c.header('X-RateLimit-Reset', String(r.timeToExpire));
}

/**
 * Throttling par route et par IP pour toute l'app (équivalent du ThrottlerGuard global).
 * Les 404 ne sont pas comptées, comme sous Nest.
 */
export const rateLimit = (store: RateLimitStore) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const route = matchedRoute(c);
    if (route) {
      const rule =
        matchedRoutes(c)
          .map((r) => routeRules.get(r.handler))
          .findLast((x) => x !== undefined) ?? DEFAULT_THROTTLE;
      check(c, store, `${route}|ip:${c.get('clientIp')}`, rule);
    }
    await next();
  });

/** À placer sur une route : sa règle remplace DEFAULT_THROTTLE (le comptage reste global). */
export function throttle(rule: ThrottleRule): MiddlewareHandler {
  const marker: MiddlewareHandler = async (_c, next) => {
    await next();
  };
  routeRules.set(marker, rule);
  return marker;
}

/**
 * Second compteur, clé = e-mail du corps JSON (et non IP) : un attaquant réparti sur N adresses
 * obtient sinon N × la limite contre UN compte. Sans e-mail exploitable, rien de plus que le
 * compteur par IP déjà appliqué.
 */
export const throttleByEmail = (store: RateLimitStore, rule: ThrottleRule) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const body: unknown = await c.req.json().catch(() => undefined);
    const raw = (body as { email?: unknown } | undefined)?.email;
    const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    const route = matchedRoute(c);
    if (email && route) check(c, store, `${route}|email:${email}`, rule);
    await next();
  });
