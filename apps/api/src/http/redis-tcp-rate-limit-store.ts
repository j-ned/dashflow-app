import { createClient } from 'redis';
import { z } from 'zod';
import { createLogger } from '../common/logger';
import type { ThrottleResult, ThrottleRule } from './rate-limit-store';
import {
  THROTTLE_SCRIPT,
  throttleArgs,
  throttleKeys,
} from './redis-rate-limit-store';

const logger = createLogger('RedisThrottle');

/** Réponse du script : [coups comptés, bloqué (0/1), ms avant fin de fenêtre, ms avant fin du blocage]. */
const throttleReply = z.tuple([z.number(), z.number(), z.number(), z.number()]);

/** Pas de nouvelle tentative au-delà de 5 s d'écart : Redis est dans la même pile que l'API. */
const reconnectDelay = (retries: number): number =>
  Math.min(100 * 2 ** retries, 5_000);

/**
 * Même stockage que RedisRateLimitStore (même script Lua, mêmes clés), joint en TCP : un Redis de
 * la pile Dokploy plutôt que l'API REST d'Upstash. Compteurs partagés par toutes les instances.
 *
 * Redis indisponible : la requête échoue tout de suite (`disableOfflineQueue`) au lieu d'attendre
 * en file, et le client se reconnecte de lui-même. Le throttling n'est jamais contourné en silence.
 */
export class RedisTcpRateLimitStore {
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
      logger.error(
        `Redis (throttling) : ${err instanceof Error ? err.message : String(err)}`,
      ),
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

  /** Les compteurs vivent dans Redis : rien à libérer en mémoire (cf. close). */
  dispose(): void {}

  /** Ferme la connexion, après les commandes en cours. */
  async close(): Promise<void> {
    if (this.client.isOpen) await this.client.close();
  }
}
