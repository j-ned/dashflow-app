import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { DRIZZLE } from '../../db/drizzle.constants';
import { EnvelopesService } from './envelopes.service';

type FakeDbOptions = {
  selectResult: unknown[];
  updateResult: unknown[];
};

function createFakeDb(opts: FakeDbOptions) {
  const updatePatches: Record<string, unknown>[] = [];
  const insertValues: Record<string, unknown>[] = [];
  let transactionCalled = false;

  const tx = {
    update: (_table: unknown) => ({
      set: (patch: Record<string, unknown>) => {
        updatePatches.push(patch);
        return {
          where: () => ({
            returning: () => Promise.resolve(opts.updateResult),
          }),
        };
      },
    }),
    insert: (_table: unknown) => ({
      values: (v: Record<string, unknown>) => {
        insertValues.push(v);
        return Promise.resolve([]);
      },
    }),
  };

  const db = {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve(opts.selectResult) }),
      }),
    }),
    transaction: (cb: (t: typeof tx) => unknown) => {
      transactionCalled = true;
      return Promise.resolve(cb(tx));
    },
  };

  return {
    db,
    updatePatches,
    insertValues,
    wasTransactionCalled: () => transactionCalled,
  };
}

async function createService(opts: FakeDbOptions) {
  const fake = createFakeDb(opts);
  const moduleRef = await Test.createTestingModule({
    providers: [EnvelopesService, { provide: DRIZZLE, useValue: fake.db }],
  }).compile();
  return { svc: moduleRef.get(EnvelopesService), ...fake };
}

describe('EnvelopesService.credit', () => {
  it('applique une arithmétique monétaire sûre (pas de dérive flottante)', async () => {
    const { svc, updatePatches } = await createService({
      selectResult: [{ id: 'env-1', balance: '10.10' }],
      updateResult: [{ id: 'env-1', balance: '10.3' }],
    });

    const result = await svc.credit('user-1', 'env-1', { amount: 0.2 });

    expect(result).toEqual({ id: 'env-1', balance: '10.3' });
    expect(updatePatches[0]).toEqual({ balance: '10.3' });
  });

  it('accepte un montant négatif : le solde peut devenir négatif (aucun clamp)', async () => {
    const { svc, updatePatches } = await createService({
      selectResult: [{ id: 'env-1', balance: '5' }],
      updateResult: [{ id: 'env-1', balance: '-5' }],
    });

    await svc.credit('user-1', 'env-1', { amount: -10 });

    expect(updatePatches[0]).toEqual({ balance: '-5' });
  });

  it("retourne undefined sans ouvrir de transaction si l'enveloppe n'appartient pas à l'utilisateur", async () => {
    const { svc, wasTransactionCalled } = await createService({
      selectResult: [],
      updateResult: [],
    });

    const result = await svc.credit('user-1', 'env-x', { amount: 10 });

    expect(result).toBeUndefined();
    expect(wasTransactionCalled()).toBe(false);
  });

  it('en mode chiffré, met à jour uniquement encryptedData (le solde brut reste intouché côté serveur)', async () => {
    const { svc, updatePatches, insertValues } = await createService({
      selectResult: [{ id: 'env-1', balance: '10.10' }],
      updateResult: [{ id: 'env-1', encryptedData: 'cipher' }],
    });

    await svc.credit('user-1', 'env-1', { encryptedData: 'cipher' });

    expect(updatePatches[0]).toEqual({ encryptedData: 'cipher' });
    expect(insertValues[0]).toMatchObject({
      envelopeId: 'env-1',
      encryptedData: 'cipher',
    });
  });
});
