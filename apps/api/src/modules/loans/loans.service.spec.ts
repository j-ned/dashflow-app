import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
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
    // SELECT ... FOR UPDATE dans la transaction : renvoie la même ligne que la lecture d'ownership.
    select: () => ({
      from: () => ({
        where: () => ({ for: () => Promise.resolve(opts.selectResult) }),
      }),
    }),
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

  it('refuse un paiement supérieur au restant dû (400) : rien n’est écrit', async () => {
    const { svc, updatePatches, insertValues } = await createService({
      selectResult: [{ id: 'loan-1', remaining: '50' }],
      updateResult: [{ id: 'loan-1', remaining: '0' }],
    });

    await expect(
      svc.recordPayment('user-1', 'loan-1', { amount: 80 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updatePatches).toHaveLength(0);
    expect(insertValues).toHaveLength(0);
  });

  it('accepte un paiement égal au restant dû : le prêt passe à 0', async () => {
    const { svc, updatePatches, insertValues } = await createService({
      selectResult: [{ id: 'loan-1', remaining: '50' }],
      updateResult: [{ id: 'loan-1', remaining: '0' }],
    });

    await svc.recordPayment('user-1', 'loan-1', { amount: 50 });

    expect(updatePatches[0]).toEqual({ remaining: '0' });
    expect(insertValues[0]).toMatchObject({ loanId: 'loan-1', amount: '50' });
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

  it('insère une loanTransaction du montant payé, cohérente avec le nouveau restant dû', async () => {
    const { svc, insertValues, updatePatches } = await createService({
      selectResult: [{ id: 'loan-1', remaining: '50' }],
      updateResult: [{ id: 'loan-1', remaining: '20' }],
    });

    await svc.recordPayment('user-1', 'loan-1', {
      amount: 30,
      date: '2026-07-01',
    });

    expect(updatePatches[0]).toEqual({ remaining: '20' });
    expect(insertValues[0]).toMatchObject({
      loanId: 'loan-1',
      amount: '30',
      date: '2026-07-01',
    });
  });
});
