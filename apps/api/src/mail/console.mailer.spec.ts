import { describe, it, expect, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { ConsoleMailer } from './console.mailer';
import type { Env } from '../config/env.schema';

const fakeConfig = { APP_URL: 'http://localhost:3001' } as Env;

describe('ConsoleMailer', () => {
  it('logge le code de vérification (une seule fois, via Logger)', async () => {
    const spy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    await new ConsoleMailer(fakeConfig).sendVerificationCode(
      'a@b.com',
      '123456',
    );
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('123456'));
    spy.mockRestore();
  });
});
