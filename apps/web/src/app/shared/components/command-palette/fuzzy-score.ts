/**
 * Score de pertinence d'une cible vis-à-vis d'une requête (recherche floue).
 * Sous-chaîne exacte → 100+ (bonus selon couverture). Sinon, score de
 * sous-séquence : +10 par caractère, bonus consécutifs et début de mot.
 * Retourne 0 si la requête n'est pas une sous-séquence de la cible.
 */
export function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  if (t.includes(q)) return 100 + (q.length / t.length) * 50;

  let score = 0;
  let qi = 0;
  let consecutive = 0;
  let lastMatchIdx = -2;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 10;
      consecutive = ti === lastMatchIdx + 1 ? consecutive + 1 : 0;
      score += consecutive * 5;
      if (ti === 0 || t[ti - 1] === ' ' || t[ti - 1] === '-') score += 8;
      lastMatchIdx = ti;
      qi++;
    }
  }

  return qi === q.length ? score : 0;
}
