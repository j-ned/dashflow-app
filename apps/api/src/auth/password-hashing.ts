import argon2 from 'argon2';
import {
  ConcurrencyLimiter,
  QueueFullError,
} from '../common/concurrency-limiter';
import { ServerBusyError } from '../common/errors';

/**
 * Hachages Argon2 simultanés : un seul. Chacun prend 64 Mo et, avec ses 4 voies, déjà tous les
 * cœurs du serveur (2) pendant quelques centaines de millisecondes. Mesuré (apps/api/load,
 * scénario mixte) : à 2 en parallèle, les pages des autres utilisateurs passaient à un p95 de
 * 1,5 s ; à 1, elles restent à 101 ms, et le débit de connexions est même meilleur.
 */
export const ARGON2_MAX_CONCURRENT = 1;
/** Hachages en attente au-delà desquels on refuse : environ 4 s d'attente au débit mesuré. */
export const ARGON2_MAX_QUEUED = 16;
/** Délai de nouvel essai annoncé quand la file est pleine (en-tête Retry-After). */
const RETRY_AFTER_SECONDS = 5;

type Argon2 = {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
};

export type PasswordHasher = Argon2;

/** Argon2 borné par `limiter` : file pleine → ServerBusyError (503, Retry-After). */
export function createPasswordHasher(
  limiter: ConcurrencyLimiter,
  impl: Argon2 = argon2,
): PasswordHasher {
  const guarded = async <T>(task: () => Promise<T>): Promise<T> => {
    try {
      return await limiter.run(task);
    } catch (err) {
      if (err instanceof QueueFullError)
        throw new ServerBusyError(RETRY_AFTER_SECONDS);
      throw err;
    }
  };
  return {
    hash: (password) => guarded(() => impl.hash(password)),
    verify: (hash, password) => guarded(() => impl.verify(hash, password)),
  };
}

/**
 * Seul point d'accès à Argon2 dans l'API : une limite pour tout le processus, puisque c'est le CPU
 * du processus qu'elle protège.
 */
export const passwordHasher = createPasswordHasher(
  new ConcurrencyLimiter(ARGON2_MAX_CONCURRENT, ARGON2_MAX_QUEUED),
);
