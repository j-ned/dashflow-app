/**
 * Référentiel centralisé des catégories de dépense.
 *
 * `category` reste un champ texte libre côté données (pas de table ni de CRUD — différé
 * au chantier Tier-1). Ce module fournit l'unique source de vérité pour les libellés
 * « connus », leurs couleurs et leur traduction, avec un **matching tolérant** (insensible
 * aux accents et à la casse) pour que « alimentation », « Alimentation » et « ALIMENTATION »
 * tombent sur la même catégorie au lieu de finir en « Autre ».
 */
type BudgetCategoryKey =
  | 'housing' | 'transport' | 'food' | 'health' | 'leisure'
  | 'subscription' | 'insurance' | 'envelope' | 'repayment' | 'other';

export type BudgetCategory = {
  readonly key: BudgetCategoryKey;
  /** Libellé FR canonique = valeur historiquement stockée en base. */
  readonly label: string;
  readonly i18nKey: string;
  readonly color: string;
}

export const BUDGET_CATEGORIES: readonly BudgetCategory[] = [
  { key: 'housing',      label: 'Logement',      i18nKey: 'budget.analytics.category.housing',      color: 'var(--color-ib-blue)' },
  { key: 'transport',    label: 'Transport',     i18nKey: 'budget.analytics.category.transport',    color: 'var(--color-ib-cyan)' },
  { key: 'food',         label: 'Alimentation',  i18nKey: 'budget.analytics.category.food',         color: 'var(--color-ib-green)' },
  { key: 'health',       label: 'Santé',         i18nKey: 'budget.analytics.category.health',       color: 'var(--color-ib-red)' },
  { key: 'leisure',      label: 'Loisirs',       i18nKey: 'budget.analytics.category.leisure',      color: 'var(--color-ib-purple)' },
  { key: 'subscription', label: 'Abonnement',    i18nKey: 'budget.analytics.category.subscription', color: 'var(--color-ib-orange)' },
  { key: 'insurance',    label: 'Assurance',     i18nKey: 'budget.analytics.category.insurance',    color: 'var(--color-ib-yellow)' },
  { key: 'envelope',     label: 'Enveloppe',     i18nKey: 'budget.analytics.category.envelope',     color: 'var(--color-ib-cyan)' },
  { key: 'repayment',    label: 'Remboursement', i18nKey: 'budget.analytics.category.repayment',    color: 'var(--color-ib-pink)' },
  { key: 'other',        label: 'Autre',         i18nKey: 'budget.analytics.category.other',        color: 'var(--color-text-muted)' },
];

const OTHER_CATEGORY = BUDGET_CATEGORIES[BUDGET_CATEGORIES.length - 1];

/** Repli accents + casse + espaces pour un appariement tolérant. */
function fold(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

const BY_FOLDED_LABEL = new Map<string, BudgetCategory>(
  BUDGET_CATEGORIES.map((category) => [fold(category.label), category]),
);

/** Résout un libellé brut (texte libre) vers une catégorie connue, sinon « Autre ». */
export function normalizeCategory(raw: string | null | undefined): BudgetCategory {
  if (!raw) return OTHER_CATEGORY;
  return BY_FOLDED_LABEL.get(fold(raw)) ?? OTHER_CATEGORY;
}

// ---------------------------------------------------------------------------
// Taxonomie groupée
// ---------------------------------------------------------------------------

export type CategoryGroup = {
  readonly key: string;
  readonly label: string;
  readonly categories: readonly BudgetCategory[];
}

export const CATEGORY_GROUPS: readonly CategoryGroup[] = [
  { key: 'living', label: 'Vie courante', categories: [
    BUDGET_CATEGORIES.find((c) => c.key === 'food')!,
    BUDGET_CATEGORIES.find((c) => c.key === 'housing')!,
    BUDGET_CATEGORIES.find((c) => c.key === 'transport')!,
  ] },
  { key: 'recurring', label: 'Récurrent', categories: [
    BUDGET_CATEGORIES.find((c) => c.key === 'subscription')!,
    BUDGET_CATEGORIES.find((c) => c.key === 'insurance')!,
    BUDGET_CATEGORIES.find((c) => c.key === 'repayment')!,
  ] },
  { key: 'wellbeing', label: 'Bien-être', categories: [
    BUDGET_CATEGORIES.find((c) => c.key === 'health')!,
    BUDGET_CATEGORIES.find((c) => c.key === 'leisure')!,
  ] },
  { key: 'misc', label: 'Divers', categories: [
    BUDGET_CATEGORIES.find((c) => c.key === 'envelope')!,
    BUDGET_CATEGORIES.find((c) => c.key === 'other')!,
  ] },
];

const BY_KEY = new Map<string, BudgetCategory & { group: string }>(
  CATEGORY_GROUPS.flatMap((g) => g.categories.map((c) => [c.key, { ...c, group: g.label }])),
);

/** Métadonnées d'un code catégorie ; retombe sur « Autre » si inconnu. */
export function categoryMeta(code: string | null | undefined): BudgetCategory & { group: string } {
  return (code && BY_KEY.get(code)) || { ...OTHER_CATEGORY, group: 'Divers' };
}
