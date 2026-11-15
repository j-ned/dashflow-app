/** File d'attente pleine : la tâche est refusée sans attendre. */
export class QueueFullError extends Error {
  override readonly name = 'QueueFullError';
}

/**
 * Borne le nombre de tâches qui s'exécutent en même temps. Au-delà, elles attendent dans une file
 * de taille bornée, servie dans l'ordre d'arrivée ; file pleine → refus immédiat (QueueFullError).
 * Une tâche terminée, en succès comme en échec, cède directement sa place à la suivante.
 */
export class ConcurrencyLimiter {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueued: number,
  ) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active < this.maxConcurrent) {
      this.active++;
    } else {
      if (this.waiting.length >= this.maxQueued) throw new QueueFullError();
      // La place est transmise par la tâche qui se termine : `active` ne bouge pas.
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    try {
      return await task();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active--;
    }
  }
}
