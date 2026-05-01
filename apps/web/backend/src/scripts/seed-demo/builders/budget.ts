// backend/src/scripts/seed-demo/builders/budget.ts
import type { db } from '@db/client';
import {
  bankAccounts,
  envelopes,
  envelopeTransactions,
  loans,
  loanTransactions,
  recurringEntries,
  salaryArchives,
} from '@db/schema';
import type { Rng } from '../rng.js';
import { intBetween } from '../rng.js';
import { BANK_ACCOUNTS, ENVELOPES, RECURRING } from '../fixtures.js';
import type { SeededFamily } from './family.js';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function seedBudget(
  tx: Tx,
  userId: string,
  family: SeededFamily,
  rng: Rng,
): Promise<void> {
  // ── Bank accounts ──
  const accounts = await tx
    .insert(bankAccounts)
    .values(BANK_ACCOUNTS.map((a) => ({ userId, name: a.name, initialBalance: a.initialBalance, color: a.color, dotColor: a.dotColor })))
    .returning({ id: bankAccounts.id });

  // ── Envelopes ──
  const insertedEnvelopes = await tx
    .insert(envelopes)
    .values(
      ENVELOPES.map((e, i) => ({
        userId,
        memberId: i % 2 === 0 ? family.patients[0]!.id : family.patients[1]!.id,
        name: e.name,
        type: e.type as any,
        balance: e.balance,
        target: e.target,
        color: e.color,
        dueDay: e.dueDay,
      })),
    )
    .returning({ id: envelopes.id });

  // ── Envelope transactions (2 per envelope, 12 total) ──
  const today = new Date();
  const envelopeTxValues = insertedEnvelopes.flatMap((env, i) => {
    const monthsAgo = (m: number) => new Date(today.getFullYear(), today.getMonth() - m, intBetween(rng, 1, 28)).toISOString().slice(0, 10);
    const target = parseFloat(ENVELOPES[i]!.target);
    const monthlyDeposit = (target / 10).toFixed(2);
    return [
      { envelopeId: env.id, amount: monthlyDeposit, date: monthsAgo(2) },
      { envelopeId: env.id, amount: monthlyDeposit, date: monthsAgo(1) },
    ];
  });
  await tx.insert(envelopeTransactions).values(envelopeTxValues);

  // ── Recurring entries ──
  await tx.insert(recurringEntries).values(
    RECURRING.map((r) => ({
      userId,
      memberId: r.memberIdx === null ? null : family.patients[r.memberIdx]!.id,
      accountId: accounts[r.accountIdx]!.id,
      label: r.label,
      amount: r.amount,
      type: r.type as any,
      dayOfMonth: r.dayOfMonth,
      category: r.category,
    })),
  );

  // ── Loans (2) ──
  const insertedLoans = await tx
    .insert(loans)
    .values([
      {
        userId,
        memberId: family.patients[1]!.id,
        person: 'Pierre (frère Thomas)',
        direction: 'borrowed',
        amount: '1500.00',
        remaining: '800.00',
        description: 'Avance pour réparation voiture',
        date: '2025-12-15',
        dueDate: '2026-08-15',
        dueDay: 15,
      },
      {
        userId,
        memberId: family.patients[0]!.id,
        person: 'Sophie (collègue Marie)',
        direction: 'lent',
        amount: '300.00',
        remaining: '0.00',
        description: 'Dépannage fin de mois',
        date: '2026-01-20',
        dueDate: '2026-02-20',
        dueDay: null,
      },
    ])
    .returning({ id: loans.id });

  // Loan transactions: 3 partial payments on first loan, 1 full on second
  await tx.insert(loanTransactions).values([
    { loanId: insertedLoans[0]!.id, amount: '200.00', date: '2026-01-15' },
    { loanId: insertedLoans[0]!.id, amount: '300.00', date: '2026-02-15' },
    { loanId: insertedLoans[0]!.id, amount: '200.00', date: '2026-03-15' },
    { loanId: insertedLoans[1]!.id, amount: '300.00', date: '2026-02-20' },
  ]);

  // ── Salary archives (6 months: nov 2025 → avril 2026) ──
  const months = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04'];
  await tx.insert(salaryArchives).values(
    months.map((month) => ({
      userId,
      accountId: accounts[0]!.id,
      month,
      salary: '4950.00',
      totalExpenses: '2664.99',
      totalSpendings: '35.98',
      spendings: [
        { label: 'Netflix', amount: '17.99' },
        { label: 'Spotify Famille', amount: '17.99' },
      ],
    })),
  );
}
