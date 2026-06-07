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
});
