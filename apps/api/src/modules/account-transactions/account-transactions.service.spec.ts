import type { DrizzleDB } from '../../db/drizzle.constants';
import { AccountTransactionsService } from './account-transactions.service';

describe('AccountTransactionsService', () => {
  it("refuse d'ajouter une transaction sur un compte qui n'appartient pas à l'utilisateur", async () => {
    const fakeDb = {
      select: () => ({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
      }),
    };
    const svc = new AccountTransactionsService(fakeDb as unknown as DrizzleDB);

    const result = await svc.addTransaction('user-1', 'acc-x', {
      amount: '10',
      direction: 'expense',
      date: '2026-06-01',
    });

    expect(result).toBeUndefined();
  });

  it('addTransaction refuse SANS interroger la base quand accountId n\'est pas un uuid (orphelin → "null")', async () => {
    // Régression : le front pouvait poster /bank-accounts/null/transactions (récurrence orpheline).
    // ownsAccount bindait alors un uuid invalide → erreur drizzle 500. La garde doit court-circuiter.
    const throwingDb = {
      select: () => {
        throw new Error('ne doit pas interroger la base avec un uuid invalide');
      },
    };
    const svc = new AccountTransactionsService(
      throwingDb as unknown as DrizzleDB,
    );
    const result = await svc.addTransaction('user-1', 'null', {
      amount: '10',
      direction: 'expense',
      date: '2026-06-01',
    });
    expect(result).toBeUndefined();
  });

  it("addBatch refuse si le compte n'appartient pas à l'utilisateur", async () => {
    const fakeDb = {
      select: () => ({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
      }),
    };
    const svc = new AccountTransactionsService(fakeDb as unknown as DrizzleDB);
    const res = await svc.addBatch('u1', 'acc-x', [
      { amount: '10', direction: 'expense', date: '2026-06-01' },
    ] as never);
    expect(res).toBeUndefined();
  });
});
