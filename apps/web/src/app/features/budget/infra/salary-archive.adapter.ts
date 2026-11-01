import { SalaryArchive } from '../domain/models/salary-archive.model';

/**
 * Normalise une archive renvoyée par l'API avant validation :
 * les colonnes `numeric` Postgres reviennent en string pour les comptes en clair
 * (compte démo, encryptionVersion=0) ; on coerce en nombre, schéma Zod et domaine
 * attendent des number. Pour un compte chiffré, ces valeurs viennent déjà du blob comme nombres.
 * Les dépenses archivées avant l'ajout de `date` / `category` (seed de la démo) n'ont pas ces clés :
 * on les ramène à `null`, sinon le schéma rejette l'archive entière.
 */
export function normalizeSalaryArchive(raw: SalaryArchive): SalaryArchive {
  return {
    ...raw,
    salary: Number(raw.salary),
    totalExpenses: Number(raw.totalExpenses),
    totalSpendings: Number(raw.totalSpendings),
    spendings: (Array.isArray(raw.spendings) ? raw.spendings : []).map((s) => ({
      ...s,
      amount: Number(s.amount),
      date: s.date ?? null,
      category: s.category ?? null,
    })),
  };
}
