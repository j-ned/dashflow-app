import { describe, it, expect, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { ConsoleMailer } from './console.mailer';
import type { Env } from '../config/env.schema';

const fakeConfig = {
  get: () => 'http://localhost:3001',
} as unknown as ConfigService<Env, true>;

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

  it("logge l'invitation calendrier avec l'url construite (une seule fois, via Logger)", async () => {
    const spy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    await new ConsoleMailer(fakeConfig).sendCalendarInvitation(
      'guest@b.com',
      'Alice',
      'abc123token',
    );
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('abc123token'));
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:3001'),
    );
    spy.mockRestore();
  });
});
