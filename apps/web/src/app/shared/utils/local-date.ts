/**
 * Date locale au format `YYYY-MM-DD`.
 *
 * `new Date().toISOString().slice(0, 10)` donne la date UTC : en France, entre minuit et 1 h/2 h du
 * matin, c'est encore la veille. Les dates métier (échéance, validité, date d'opération) sont des
 * dates civiles : elles se comparent et se préremplissent dans le fuseau de l'utilisateur.
 */
export function toLocalIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Aujourd'hui, en date locale `YYYY-MM-DD`. */
export function todayIso(): string {
  return toLocalIsoDate(new Date());
}
