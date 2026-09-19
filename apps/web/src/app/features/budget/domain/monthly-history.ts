import { addMoney } from './money';
import { AUTO_POST_NOTE } from './auto-post';
import { categoryMeta } from './categories';
import { AccountTransaction } from './models/account-transaction.model';
import { RecurringEntry } from './models/recurring-entry.model';
import { SalaryArchive, SpendingSnapshot } from './models/salary-archive.model';

/**
 * Un mois d'historique. Même forme qu'une archive (les graphiques et les cartes la lisent telle
 * quelle), plus sa provenance :
 * - `computed` : reconstitué à partir des opérations réelles du mois — aucun geste requis ;
 * - `archive` : saisi à la main, pour un mois d'avant les opérations.
 */
export type MonthRecord = SalaryArchive & {
  readonly origin: 'computed' | 'archive';
  /** Archive manuelle du même mois, si elle existe (elle porte la fiche de paie). */
  readonly archiveId: string | null;
};

const monthOf = (date: string): string => date.slice(0, 7);

/**
 * Reconstitue les mois CLOS (antérieurs à `currentMonth`) à partir des opérations réelles.
 *
 * Un mois n'est retenu que s'il contient au moins un revenu : sans lui, les opérations sont
 * partielles (on a commencé à saisir en cours de route) et le « reste » n'aurait aucun sens.
 *
 * - revenus : toutes les opérations `income` ;
 * - charges fixes : dépenses issues d'un prélèvement récurrent (ou pointées automatiquement) ;
 * - dépenses : tout le reste (dépenses saisies, relevé, imports, ajustements) ;
 * - virements : ignorés, ce sont des mouvements entre ses propres comptes.
 */
export function computeMonthRecords(
  txs: readonly AccountTransaction[],
  entries: readonly RecurringEntry[],
  currentMonth: string,
): MonthRecord[] {
  const entryById = new Map(entries.map((e) => [e.id, e]));
  const byMonth = new Map<string, AccountTransaction[]>();
  for (const t of txs) {
    const month = monthOf(t.date);
    if (month >= currentMonth) continue;
    byMonth.set(month, [...(byMonth.get(month) ?? []), t]);
  }

  const records: MonthRecord[] = [];
  for (const [month, monthTxs] of byMonth) {
    if (!monthTxs.some((t) => t.direction === 'income')) continue;

    let salary = 0;
    let totalExpenses = 0;
    let totalSpendings = 0;
    const spendings: SpendingSnapshot[] = [];
    for (const t of monthTxs) {
      if (t.direction === 'income') {
        salary = addMoney(salary, t.amount);
      } else if (t.direction === 'expense') {
        const entry = t.recurringEntryId ? entryById.get(t.recurringEntryId) : undefined;
        if (entry?.type === 'expense' || (!entry && t.note === AUTO_POST_NOTE)) {
          totalExpenses = addMoney(totalExpenses, t.amount);
        } else {
          totalSpendings = addMoney(totalSpendings, t.amount);
          // La catégorie d'une opération est une clé technique (« other ») : on montre son libellé,
          // et on ne le répète pas quand il sert déjà de nom à la ligne.
          const categoryLabel = t.category ? categoryMeta(t.category).label : null;
          const label =
            entry?.label ??
            (t.note && t.note !== AUTO_POST_NOTE ? t.note : categoryMeta(t.category).label);
          spendings.push({
            label,
            amount: t.amount,
            date: t.date,
            category: categoryLabel === label ? null : categoryLabel,
          });
        }
      }
    }
    records.push({
      id: `computed:${month}`,
      accountId: null,
      month,
      salary,
      totalExpenses,
      totalSpendings,
      spendings: spendings.sort((a, b) => ((a.date ?? '') < (b.date ?? '') ? -1 : 1)),
      payslipKey: null,
      origin: 'computed',
      archiveId: null,
    });
  }
  return records;
}

/**
 * Historique complet, du plus ancien au plus récent : le calculé l'emporte sur l'archive du même
 * mois (le réel fait foi), mais en garde l'identifiant et la fiche de paie.
 */
export function mergeHistory(
  archives: readonly SalaryArchive[],
  computed: readonly MonthRecord[],
): MonthRecord[] {
  const archiveByMonth = new Map(archives.map((a) => [a.month, a]));
  const merged = new Map<string, MonthRecord>();
  for (const a of archives) merged.set(a.month, { ...a, origin: 'archive', archiveId: a.id });
  for (const c of computed) {
    const archive = archiveByMonth.get(c.month);
    merged.set(c.month, {
      ...c,
      payslipKey: archive?.payslipKey ?? null,
      accountId: archive?.accountId ?? null,
      archiveId: archive?.id ?? null,
    });
  }
  return [...merged.values()].sort((a, b) => (a.month < b.month ? -1 : 1));
}
