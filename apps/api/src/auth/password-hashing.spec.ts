import { describe, it, expect } from 'vitest';
import { createPasswordHasher, passwordHasher } from './password-hashing';
import { ConcurrencyLimiter } from '../common/concurrency-limiter';
import { ServerBusyError } from '../common/errors';

describe('passwordHasher (Argon2 réel)', () => {
  it('hache puis vérifie un mot de passe, et refuse un autre', async () => {
    const hash = await passwordHasher.hash('un-mot-de-passe-long');

    expect(await passwordHasher.verify(hash, 'un-mot-de-passe-long')).toBe(
      true,
    );
    expect(await passwordHasher.verify(hash, 'un-autre-mot-de-passe')).toBe(
      false,
    );
  });
});

describe('createPasswordHasher : hachages simultanés bornés', () => {
  it('au-delà des hachages en cours et de la file : 503 « serveur occupé » avec un délai de nouvel essai', async () => {
    const gate = { open: (): void => undefined };
    const blocked = new Promise<string>((resolve) => {
      gate.open = () => resolve('$argon2id$…');
    });
    const hasher = createPasswordHasher(new ConcurrencyLimiter(1, 1), {
      hash: () => blocked,
      verify: () => Promise.resolve(true),
    });
    const running = hasher.hash('a');
    const queued = hasher.hash('b');

    const refused = hasher.verify('$argon2id$…', 'c');

    await expect(refused).rejects.toBeInstanceOf(ServerBusyError);
    await expect(refused).rejects.toMatchObject({
      status: 503,
      code: 'SERVER_BUSY',
      retryAfterSeconds: 5,
    });
    gate.open();
    await Promise.all([running, queued]);
  });
});
