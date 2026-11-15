import { describe, it, expect } from 'vitest';
import { SENTRY_DATA_COLLECTION } from './sentry-options';

// App E2EE (santé, budget) : rien de ce qui identifie un visiteur ou porte ses données ne part
// chez Sentry. Avec `dataCollection` renseigné, Sentry repart de valeurs par défaut qui collectent
// tout : chaque option doit donc être coupée explicitement.
describe('SENTRY_DATA_COLLECTION', () => {
  it('ni en-têtes (IP du visiteur), ni cookies, ni paramètres d’URL', () => {
    expect(SENTRY_DATA_COLLECTION.httpHeaders).toEqual({
      request: false,
      response: false,
    });
    expect(SENTRY_DATA_COLLECTION.cookies).toBe(false);
    expect(SENTRY_DATA_COLLECTION.queryParams).toBe(false);
  });

  it('ni corps de requête, ni identité, ni variables locales des fonctions', () => {
    expect(SENTRY_DATA_COLLECTION.httpBodies).toEqual([]);
    expect(SENTRY_DATA_COLLECTION.userInfo).toBe(false);
    expect(SENTRY_DATA_COLLECTION.stackFrameVariables).toBe(false);
    expect(SENTRY_DATA_COLLECTION.genAI).toEqual({
      inputs: false,
      outputs: false,
    });
  });
});
