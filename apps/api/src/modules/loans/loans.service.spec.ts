import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { DRIZZLE } from '../../db/drizzle.constants';
import { LoansService } from './loans.service';

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
    providers: [LoansService, { provide: DRIZZLE, useValue: fake.db }],
  }).compile();
  return { svc: moduleRef.get(LoansService), ...fake };
}

describe('LoansService.recordPayment', () => {
  it('applique une arithmétique monétaire sûre (pas de dérive flottante)', async () => {
    const { svc, updatePatches } = await createService({
      selectResult: [{ id: 'loan-1', remaining: '100.10' }],
      updateResult: [{ id: 'loan-1', remaining: '99.9' }],
    });

    const result = await svc.recordPayment('user-1', 'loan-1', {
      amount: 0.2,
    });

    expect(result).toEqual({ id: 'loan-1', remaining: '99.9' });
    expect(updatePatches[0]).toEqual({ remaining: '99.9' });
  });

  it('clampe le remaining à 0 quand le paiement dépasse le solde restant (Math.max(0, ...))', async () => {
    const { svc, updatePatches } = await createService({
      selectResult: [{ id: 'loan-1', remaining: '50' }],
      updateResult: [{ id: 'loan-1', remaining: '0' }],
    });

    await svc.recordPayment('user-1', 'loan-1', { amount: 80 });

    expect(updatePatches[0]).toEqual({ remaining: '0' });
  });

  it("retourne undefined sans ouvrir de transaction si le prêt n'appartient pas à l'utilisateur", async () => {
    const { svc, wasTransactionCalled } = await createService({
      selectResult: [],
      updateResult: [],
    });

    const result = await svc.recordPayment('user-1', 'loan-x', {
      amount: 10,
    });

    expect(result).toBeUndefined();
    expect(wasTransactionCalled()).toBe(false);
  });

  it('insère une loanTransaction avec le montant réellement payé (pas le montant clampé)', async () => {
    const { svc, insertValues } = await createService({
      selectResult: [{ id: 'loan-1', remaining: '50' }],
      updateResult: [{ id: 'loan-1', remaining: '0' }],
    });

    await svc.recordPayment('user-1', 'loan-1', {
      amount: 80,
      date: '2026-07-01',
    });

    expect(insertValues[0]).toMatchObject({
      loanId: 'loan-1',
      amount: '80',
      date: '2026-07-01',
    });
  });
});
