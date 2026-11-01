import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReportingErrorHandler, reportError, startErrorReporting } from './error-reporter';

// En test comme en dev, `environment.sentryDsn` est vide : rien ne doit être chargé ni envoyé.
describe('error-reporter sans DSN', () => {
  afterEach(() => vi.restoreAllMocks());

  it('startErrorReporting et reportError sont sans effet et ne lèvent rien', () => {
    expect(() => startErrorReporting()).not.toThrow();
    expect(() => reportError(new Error('x'), { flow: 'test' })).not.toThrow();
  });

  it('ReportingErrorHandler journalise toujours l’erreur en console', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Error('boom');

    new ReportingErrorHandler().handleError(error);

    expect(log).toHaveBeenCalledWith(error);
  });
});
