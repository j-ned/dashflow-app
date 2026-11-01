export type RecurringEntryType = 'income' | 'expense' | 'annual_expense' | 'spending' | 'transfer';

export type RecurringEntry = {
  id: string;
  memberId: string | null;
  accountId: string | null;
  toAccountId: string | null;
  label: string;
  amount: number;
  type: RecurringEntryType;
  dayOfMonth: number | null;
  date: string | null;
  endDate: string | null;
  category: string | null;
  payslipKey: string | null;
  autoPost: boolean;
  autoPostSince: string | null; // 'YYYY-MM' figé à l'activation de autoPost ; null si autoPost=false
  /**
   * Revenu dont le montant change chaque mois (salaire avec primes, heures, intérim…). `amount`
   * n'est alors qu'un ordre de grandeur : il n'est ni prérempli à la confirmation, ni compté dans
   * le projeté tant que le montant réel du mois n'a pas été saisi. N'a de sens que pour `income`.
   */
  variableAmount: boolean;
};
