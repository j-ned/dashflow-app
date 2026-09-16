import { describe, it, expect } from 'vitest';
import { clientRowId } from './client-row-id';

const ID = '11111111-1111-4111-8111-111111111111';

describe('clientRowId', () => {
  it('accepte un UUID sur une création chiffrée', () => {
    expect(clientRowId({ encryptedData: 'x', id: ID })).toEqual({ id: ID });
  });
  it('ignore hors E2EE, non-UUID ou absent', () => {
    expect(clientRowId({ id: ID })).toEqual({});
    expect(clientRowId({ encryptedData: 'x', id: 'abc' })).toEqual({});
    expect(clientRowId({ encryptedData: 'x' })).toEqual({});
  });
});
