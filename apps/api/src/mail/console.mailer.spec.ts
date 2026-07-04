import { describe, it, expect, vi } from 'vitest';
import { ConsoleMailer } from './console.mailer';

const fakeConfig = { get: () => 'http://localhost:3001' } as any;

describe('ConsoleMailer', () => {
  it('logge le code de vérification', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await new ConsoleMailer(fakeConfig).sendVerificationCode(
      'a@b.com',
      '123456',
    );
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('123456'));
    spy.mockRestore();
  });

  it("logge l'invitation calendrier avec l'url construite", async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await new ConsoleMailer(fakeConfig).sendCalendarInvitation(
      'guest@b.com',
      'Alice',
      'abc123token',
    );
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('abc123token'));
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:3001'),
    );
    spy.mockRestore();
  });
});
