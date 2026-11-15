import { createClient } from 'redis';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createLogger } from '../common/logger';
import type { ThrottleResult, ThrottleRule } from './rate-limit-store';
import { describeError } from '../common/describe-error';

const logger = createLogger('RedisThrottle');

/**
 * Même sémantique que RateLimitStore (fenêtre glissante, blocage `blockMs`, requêtes non comptées
 * pendant le blocage), mais partagée entre toutes les instances de l'API : un compteur en mémoire
 * serait propre à chacune, donc contournable. Un seul script Lua par requête :
 * lecture-décision-écriture atomiques, pas de course entre instances.
 *
 * KEYS : [coups (zset), blocage (chaîne à durée de vie), fenêtre (chaîne à durée de vie)]
 * ARGV : [maintenant ms, ttl ms, limite, blocage ms, membre unique]
 * Rend : [coups comptés, bloqué (0/1), ms avant fin de fenêtre, ms avant fin du blocage]
 */
const THROTTLE_SCRIPT = `
local now = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local block = tonumber(ARGV[4])

local blocked = redis.call('PTTL', KEYS[2])
local window = redis.call('PTTL', KEYS[3])
if blocked > 0 then
  return { redis.call('ZCARD', KEYS[1]), 1, math.max(window, 0), blocked }
end

if window <= 0 then
  redis.call('SET', KEYS[3], '1', 'PX', ttl)
  window = ttl
end
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - ttl)
redis.call('ZADD', KEYS[1], now, ARGV[5])
redis.call('PEXPIRE', KEYS[1], ttl)
local hits = redis.call('ZCARD', KEYS[1])
if hits > limit then
  redis.call('SET', KEYS[2], '1', 'PX', block)
  -- À la levée du blocage, le compteur repart de zéro (comme le stockage en mémoire).
  redis.call('DEL', KEYS[1])
  return { hits, 1, window, block }
end
return { hits, 0, window, 0 }
`;

/** Clés Redis d'un compteur : coups, blocage, fenêtre (cf. KEYS du script). */
const throttleKeys = (key: string): string[] => {
  const base = `rl:${key}`;
  return [`${base}:hits`, `${base}:block`, `${base}:window`];
};

/** Arguments du script (cf. ARGV) ; le membre unique distingue deux requêtes de la même ms. */
const throttleArgs = (rule: ThrottleRule): string[] => [
  String(Date.now()),
  String(rule.ttlMs),
  String(rule.limit),
  String(rule.blockMs ?? rule.ttlMs),
  randomUUID(),
];

/** Réponse du script : [coups comptés, bloqué (0/1), ms avant fin de fenêtre, ms avant fin du blocage]. */
const throttleReply = z.tuple([z.number(), z.number(), z.number(), z.number()]);

/** Pas de nouvelle tentative au-delà de 5 s d'écart : Redis est dans la même pile que l'API. */
const reconnectDelay = (retries: number): number =>
  Math.min(100 * 2 ** retries, 5_000);

/**
 * Compteurs de throttling dans Redis (service Redis de Dokploy), joint en TCP, partagés par
 * toutes les instances de l'API.
 *
 * Redis indisponible : la requête échoue tout de suite (`disableOfflineQueue`) au lieu d'attendre
 * en file, et le client se reconnecte de lui-même. Le throttling n'est jamais contourné en silence.
 */
export class RedisRateLimitStore {
  private readonly client;

  constructor(url: string) {
    this.client = createClient({
      url,
      disableOfflineQueue: true,
      socket: { connectTimeout: 2_000, reconnectStrategy: reconnectDelay },
    });
    // Sans écouteur, une erreur de connexion arrêterait le processus. Elle est journalisée ; la
    // requête concernée, elle, échoue avec sa propre erreur.
    this.client.on('error', (err: unknown) =>
      logger.error(`Redis (throttling) : ${describeError(err)}`),
    );
  }

  /** Se résout une fois Redis joint ; réessaie tant qu'il ne répond pas. */
  async connect(): Promise<void> {
    await this.client.connect();
  }

  async increment(key: string, rule: ThrottleRule): Promise<ThrottleResult> {
    const reply = await this.client.eval(THROTTLE_SCRIPT, {
      keys: throttleKeys(key),
      arguments: throttleArgs(rule),
    });
    const [hits, blocked, windowMs, blockMs] = throttleReply.parse(reply);
    return {
      totalHits: hits,
      isBlocked: blocked === 1,
      timeToExpire: Math.ceil(windowMs / 1000),
      timeToBlockExpire: Math.ceil(blockMs / 1000),
    };
  }

  /** Redis répond ; échoue tout de suite s'il est déconnecté (pas de file d'attente). */
  async ping(): Promise<void> {
    await this.client.ping();
  }

  /** Les compteurs vivent dans Redis : rien à libérer en mémoire (cf. close). */
  dispose(): void {}

  /** Ferme la connexion, après les commandes en cours. */
  async close(): Promise<void> {
    if (this.client.isOpen) await this.client.close();
  }
}
