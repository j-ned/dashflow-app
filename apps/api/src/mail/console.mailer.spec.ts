import { describe, it, expect, vi } from 'vitest';
import { ConsoleMailer } from './console.mailer';

describe('ConsoleMailer', () => {
  it('logge le code de vérification', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await new ConsoleMailer().sendVerificationCode('a@b.com', '123456');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('123456'));
    spy.mockRestore();
  });
});
