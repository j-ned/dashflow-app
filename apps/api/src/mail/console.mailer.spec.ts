import { describe, it, expect, vi } from 'vitest';
import { ConsoleMailer } from './console.mailer';
import type { Env } from '../config/env.schema';

const fakeConfig = { APP_URL: 'http://localhost:3001' } as Env;

describe('ConsoleMailer', () => {
  it('logge le code de vérification (une seule ligne, via le logger applicatif)', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await new ConsoleMailer(fakeConfig).sendVerificationCode(
      'a@b.com',
      '123456',
    );
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.stringMatching(/ LOG \[ConsoleMailer\] .*123456/),
    );
    spy.mockRestore();
  });
});
