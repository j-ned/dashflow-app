import type { Env } from '../config/env.schema';
import { RateLimitStore, type RateLimiter } from './rate-limit-store';
import { RedisRateLimitStore } from './redis-rate-limit-store';

export type RateLimiterHandle = {
  readonly limiter: RateLimiter;
  /** Établit la connexion (Redis) ; se résout quand le stockage est utilisable. */
  readonly connect: () => Promise<void>;
  /** Libère le stockage (ferme la connexion Redis). */
  readonly close: () => Promise<void>;
};

/**
 * Stockage des compteurs de throttling :
 * - REDIS_URL : Redis (service de Dokploy), partagé par toutes les instances de l'API ;
 * - sinon en mémoire : correct pour un seul processus (local, tests), remis à zéro à chaque
 *   redémarrage.
 */
export function createRateLimiter(
  env: Pick<Env, 'REDIS_URL'>,
): RateLimiterHandle {
  if (env.REDIS_URL) {
    const store = new RedisRateLimitStore(env.REDIS_URL);
    return {
      limiter: store,
      connect: () => store.connect(),
      close: () => store.close(),
    };
  }
  const limiter = new RateLimitStore();
  return {
    limiter,
    connect: () => Promise.resolve(),
    close: () => {
      limiter.dispose();
      return Promise.resolve();
    },
  };
}
