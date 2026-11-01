import * as z from 'zod/mini';
import { describe, expect, it, vi } from 'vitest';
import { validateList, validateOne } from './validate-decrypted';

const Schema = z.object({ id: z.string(), amount: z.number() });

describe('validate-decrypted', () => {
  it('validateList garde les lignes valides et exclut les invalides', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const rows = [
      { id: 'a', amount: 10 },
      { id: 'b', amount: 'NaN' },
      { id: 'c', amount: 20 },
    ];
    const out = validateList(Schema, rows, { entity: 'Test' });
    expect(out.map((r) => r.id)).toEqual(['a', 'c']);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('validateList exclut une ligne à champ requis manquant', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const out = validateList(Schema, [{ id: 'a' }], { entity: 'Test' });
    expect(out).toEqual([]);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('validateOne renvoie l’objet typé quand valide', () => {
    expect(validateOne(Schema, { id: 'a', amount: 10 }, { entity: 'Test' })).toEqual({
      id: 'a',
      amount: 10,
    });
  });

  it('validateOne throw quand invalide', () => {
    expect(() => validateOne(Schema, { id: 'a' }, { entity: 'Test' })).toThrow();
  });

  it('ne logge jamais la valeur brute déchiffrée (defense-in-depth fuite Sentry via breadcrumb console)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    validateList(Schema, [{ id: 'secret-medical-note', amount: 'NaN' }], { entity: 'Test' });
    const [, loggedIssues] = spy.mock.calls[0] as [string, { code: string; path: PropertyKey[] }[]];
    expect(JSON.stringify(loggedIssues)).not.toContain('secret-medical-note');
    expect(loggedIssues[0]).toEqual({ code: 'invalid_type', path: ['amount'] });
    spy.mockRestore();
  });
});
