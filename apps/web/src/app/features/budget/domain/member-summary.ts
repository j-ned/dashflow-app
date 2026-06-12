import { Envelope } from './models/envelope.model';
import { Loan } from './models/loan.model';
import { Member } from './models/member.model';
import { RecurringEntry } from './models/recurring-entry.model';
import { isExpensePassed } from './salary-cycle';
import { isEntryActive, isSpendingInMonth } from './analytics-monthly';

export type MemberSummary = {
  readonly id: string | null;
  readonly label: string;
  readonly initials: string;
  readonly envelopes: Envelope[];
  readonly totalEnvelopes: number;
  readonly lentLoans: Loan[];
  readonly totalLent: number;
  readonly borrowedLoans: Loan[];
  readonly totalBorrowed: number;
  readonly incomes: RecurringEntry[];
  readonly totalIncome: number;
  readonly monthlyExpenses: RecurringEntry[];
  readonly totalMonthlyExpenses: number;
  readonly annualExpenses: RecurringEntry[];
  readonly totalAnnualExpenses: number;
  readonly monthlyAnnualExpenses: number;
  readonly spendings: RecurringEntry[];
  readonly totalSpendings: number;
  readonly remaining: number;
  readonly isExpensePassed: (entry: RecurringEntry) => boolean;
};

export type MemberSummaryInput = {
  readonly envelopes: readonly Envelope[];
  readonly loans: readonly Loan[];
  readonly members: readonly Member[];
  readonly entries: readonly RecurringEntry[];
  readonly globalLabel: string;
  readonly globalInitials: string;
};

export type SummaryClock = { readonly currentMonth: string; readonly today: number };

export function buildMemberSummaries(
  input: MemberSummaryInput,
  clock: SummaryClock,
): MemberSummary[] {
  const envs = input.envelopes;
  const allLoans = input.loans;
  const allEntries = input.entries;
  const mbrs = input.members;

  const memberAccountIds = new Map<string, Set<string>>();
  for (const m of mbrs) {
    const accountIds = new Set<string>();
    for (const e of allEntries) {
      if (e.memberId === m.id && e.accountId) accountIds.add(e.accountId);
    }
    memberAccountIds.set(m.id, accountIds);
  }
  const claimedEntryIds = new Set<string>();

  const buildSummary = (
    id: string | null,
    label: string,
    initials: string,
    claimedIds?: Set<string>,
  ): MemberSummary => {
    let mEnvs: Envelope[];
    let mLoans: Loan[];
    let mEntries: RecurringEntry[];
    const singleMember = mbrs.length === 1;
    if (id) {
      const own = allEntries.filter((e) => e.memberId === id);
      if (singleMember) {
        const orphans = allEntries.filter((e) => !e.memberId);
        orphans.forEach((e) => claimedIds?.add(e.id));
        mEntries = [...own, ...orphans];
      } else {
        const accountIds = memberAccountIds.get(id)!;
        const shared = allEntries.filter(
          (e) => !e.memberId && e.accountId && accountIds.has(e.accountId),
        );
        shared.forEach((e) => claimedIds?.add(e.id));
        mEntries = [...own, ...shared];
      }
      mEnvs = envs.filter((e) => e.memberId === id || (singleMember && !e.memberId)) as Envelope[];
      mLoans = allLoans.filter((l) => l.memberId === id || (singleMember && !l.memberId)) as Loan[];
    } else {
      mEntries = allEntries.filter((e) => !e.memberId && !claimedIds?.has(e.id));
      mEnvs = (singleMember ? [] : envs.filter((e) => !e.memberId)) as Envelope[];
      mLoans = singleMember ? [] : (allLoans.filter((l) => !l.memberId) as Loan[]);
    }

    const lent = mLoans.filter((l) => l.direction === 'lent');
    const borrowed = mLoans.filter((l) => l.direction === 'borrowed');
    const currentMonth = clock.currentMonth;
    const incomes = mEntries.filter((e) => e.type === 'income' && isEntryActive(e, currentMonth));
    const monthlyExp = mEntries
      .filter((e) => e.type === 'expense' && isEntryActive(e, currentMonth))
      .sort((a, b) => (a.dayOfMonth ?? 32) - (b.dayOfMonth ?? 32));
    const annualExp = mEntries.filter(
      (e) => e.type === 'annual_expense' && isEntryActive(e, currentMonth),
    );
    const spendings = mEntries.filter(
      (e) => e.type === 'spending' && isSpendingInMonth(e, currentMonth),
    );

    const totalIncome = incomes.reduce((s, e) => s + Number(e.amount), 0);
    const totalMonthlyExp = monthlyExp.reduce((s, e) => s + Number(e.amount), 0);
    const totalAnnualExp = annualExp.reduce((s, e) => s + Number(e.amount), 0);
    const monthlyAnnual = totalAnnualExp / 12;
    const totalSpend = spendings.reduce((s, e) => s + Number(e.amount), 0);

    const salaryDay = incomes.find((e) => e.dayOfMonth)?.dayOfMonth ?? 1;

    return {
      id,
      label,
      initials,
      envelopes: mEnvs,
      totalEnvelopes: mEnvs.reduce((s, e) => s + e.balance, 0),
      lentLoans: lent,
      totalLent: lent.reduce((s, l) => s + l.remaining, 0),
      borrowedLoans: borrowed,
      totalBorrowed: borrowed.reduce((s, l) => s + l.remaining, 0),
      incomes,
      totalIncome,
      monthlyExpenses: monthlyExp,
      totalMonthlyExpenses: totalMonthlyExp,
      annualExpenses: annualExp,
      totalAnnualExpenses: totalAnnualExp,
      monthlyAnnualExpenses: monthlyAnnual,
      spendings,
      totalSpendings: totalSpend,
      remaining: totalIncome - totalMonthlyExp - monthlyAnnual - totalSpend,
      isExpensePassed: (entry) => isExpensePassed(entry, salaryDay, clock.today),
    };
  };

  const summaries: MemberSummary[] = [];

  for (const m of mbrs) {
    const ms = buildSummary(
      m.id,
      `${m.firstName} ${m.lastName}`,
      `${m.firstName[0]}${m.lastName[0]}`,
      claimedEntryIds,
    );
    if (
      ms.envelopes.length > 0 ||
      ms.lentLoans.length > 0 ||
      ms.borrowedLoans.length > 0 ||
      ms.incomes.length > 0 ||
      ms.monthlyExpenses.length > 0 ||
      ms.annualExpenses.length > 0 ||
      ms.spendings.length > 0
    ) {
      summaries.push(ms);
    }
  }

  const global = buildSummary(null, input.globalLabel, input.globalInitials, claimedEntryIds);
  if (
    global.envelopes.length > 0 ||
    global.lentLoans.length > 0 ||
    global.borrowedLoans.length > 0 ||
    global.incomes.length > 0 ||
    global.monthlyExpenses.length > 0 ||
    global.annualExpenses.length > 0 ||
    global.spendings.length > 0
  ) {
    summaries.unshift(global);
  }

  return summaries;
}
