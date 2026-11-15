import { describe, it, expect } from 'vitest';
import { ConcurrencyLimiter, QueueFullError } from './concurrency-limiter';

/** Tâche dont on décide quand elle se termine. */
function deferred() {
  const settle = {
    resolve: (): void => undefined,
    reject: (_e: Error): void => undefined,
  };
  const promise = new Promise<void>((resolve, reject) => {
    settle.resolve = resolve;
    settle.reject = reject;
  });
  return {
    promise,
    resolve: () => settle.resolve(),
    reject: (e: Error) => settle.reject(e),
  };
}

/** Laisse s'exécuter les continuations de promesses en attente. */
const flush = () => new Promise<void>((r) => setImmediate(r));

describe('ConcurrencyLimiter', () => {
  it('n’exécute jamais plus de tâches à la fois que la limite', async () => {
    const limiter = new ConcurrencyLimiter(2, 10);
    const tasks = [deferred(), deferred(), deferred()];
    const started: number[] = [];

    const runs = tasks.map((t, i) =>
      limiter.run(() => {
        started.push(i);
        return t.promise;
      }),
    );
    await flush();
    expect(started).toEqual([0, 1]);

    tasks[0]?.resolve();
    await flush();
    expect(started).toEqual([0, 1, 2]);

    tasks[1]?.resolve();
    tasks[2]?.resolve();
    await Promise.all(runs);
  });

  it('les tâches en attente partent dans l’ordre d’arrivée', async () => {
    const limiter = new ConcurrencyLimiter(1, 10);
    const first = deferred();
    const order: string[] = [];

    const runs = [
      limiter.run(() => first.promise),
      limiter.run(() => {
        order.push('b');
        return Promise.resolve();
      }),
      limiter.run(() => {
        order.push('c');
        return Promise.resolve();
      }),
    ];
    first.resolve();
    await Promise.all(runs);

    expect(order).toEqual(['b', 'c']);
  });

  it('file pleine : refuse tout de suite, sans attendre', async () => {
    const limiter = new ConcurrencyLimiter(1, 1);
    const busy = deferred();
    const running = limiter.run(() => busy.promise);
    const queued = limiter.run(() => Promise.resolve());

    await expect(limiter.run(() => Promise.resolve())).rejects.toBeInstanceOf(
      QueueFullError,
    );

    busy.resolve();
    await Promise.all([running, queued]);
  });

  it('une tâche en échec libère sa place pour la suivante', async () => {
    const limiter = new ConcurrencyLimiter(1, 1);
    const failing = deferred();
    const first = limiter.run(() => failing.promise);
    const second = limiter.run(() => Promise.resolve('suivante'));

    failing.reject(new Error('argon2 en échec'));

    await expect(first).rejects.toThrow('argon2 en échec');
    await expect(second).resolves.toBe('suivante');
  });
});
