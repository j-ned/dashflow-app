import { RecurringEntry } from './models/recurring-entry.model';

export type PendingCharge = {
  readonly entry: RecurringEntry;
  readonly direction: 'income' | 'expense' | 'transfer';
  readonly suggestedDate: string;
  /**
   * Montant proposé à la confirmation. `null` pour un revenu à montant variable : le champ reste
   * vide, c'est à l'utilisateur de saisir ce qu'il a réellement reçu ce mois-ci.
   */
  readonly suggestedAmount: number | null;
};

/** Un revenu se « reçoit », un prélèvement ou un virement se « débite » : deux gestes, deux listes. */
export const isIncomeCharge = (c: PendingCharge): boolean => c.direction === 'income';
