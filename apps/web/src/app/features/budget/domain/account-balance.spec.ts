import { confirmedBalance, isRecurrencePosted } from './account-balance';
import { AccountTransaction } from './models/account-transaction.model';

const tx = (p: Partial<AccountTransaction>): AccountTransaction => ({
  id: 'x',
  accountId: 'a',
  amount: 0,
  direction: 'expense',
  toAccountId: null,
  date: '2026-06-01',
  category: null,
  note: null,
  memberId: null,
  recurringEntryId: null,
  ...p,
});

describe('confirmedBalance', () => {
  it('part du solde initial puis ajoute revenus et soustrait dépenses (≤ asOf)', () => {
    const txs = [
      tx({ direction: 'income', amount: 2000, date: '2026-06-01' }),
      tx({ direction: 'expense', amount: 500, date: '2026-06-02' }),
      tx({ direction: 'expense', amount: 999, date: '2026-06-30' }),
    ];
    expect(confirmedBalance({ initialBalance: 100 }, txs, '2026-06-15')).toBe(1600);
  });

  it('un transfert sortant débite le compte, un transfert entrant le crédite', () => {
    const out = tx({ direction: 'transfer', amount: 50, accountId: 'a', toAccountId: 'b' });
    const inc = tx({ direction: 'transfer', amount: 50, accountId: 'c', toAccountId: 'a' });
    expect(confirmedBalance({ initialBalance: 0, id: 'a' }, [out, inc], '2026-12-31')).toBe(0);
  });
});

describe('isRecurrencePosted', () => {
  it('vrai si une transaction porte le recurringEntryId pour ce mois', () => {
    const txs = [tx({ recurringEntryId: 'r1', date: '2026-06-05' })];
    expect(isRecurrencePosted('r1', '2026-06', txs)).toBe(true);
    expect(isRecurrencePosted('r1', '2026-07', txs)).toBe(false);
    expect(isRecurrencePosted('r2', '2026-06', txs)).toBe(false);
  });
});
