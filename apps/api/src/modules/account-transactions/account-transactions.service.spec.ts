import { Test } from '@nestjs/testing';
import { DRIZZLE } from '../../db/drizzle.constants';
import { AccountTransactionsService } from './account-transactions.service';

describe('AccountTransactionsService', () => {
  it('refuse d\'ajouter une transaction sur un compte qui n\'appartient pas à l\'utilisateur', async () => {
    const fakeDb = {
      select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [AccountTransactionsService, { provide: DRIZZLE, useValue: fakeDb }],
    }).compile();
    const svc = moduleRef.get(AccountTransactionsService);

    const result = await svc.addTransaction('user-1', 'acc-x', {
      amount: '10', direction: 'expense', date: '2026-06-01',
    });

    expect(result).toBeUndefined();
  });

  it('addBatch refuse si le compte n\'appartient pas à l\'utilisateur', async () => {
    const fakeDb = { select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }) };
    const moduleRef = await Test.createTestingModule({
      providers: [AccountTransactionsService, { provide: DRIZZLE, useValue: fakeDb }],
    }).compile();
    const svc = moduleRef.get(AccountTransactionsService);
    const res = await svc.addBatch('u1', 'acc-x', [{ amount: '10', direction: 'expense', date: '2026-06-01' }] as never);
    expect(res).toBeUndefined();
  });
});
