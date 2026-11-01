# Tier 1 « effet Money » — Phase 2 : Bascule du dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠️ Contexte commits.** Repo unique concerné : **front `dash-flow`** (aucun changement backend). Pour CETTE exécution, l'utilisateur a autorisé l'auto-commit sur la branche courante (`master`, **jamais de push**) — la règle mémoire « no auto-commit J-Ned » est levée ici. Les étapes « Commit » s'exécutent réellement.

**Goal:** Faire afficher au dashboard `bank-account.ts` un **solde confirmé** (transactions réelles) et un **solde projeté** (confirmé + récurrences non postées), au lieu des deux soldes purement prévisionnels actuels.

**Architecture:** Intégration *en place* : on garde la logique de prévision dans le composant et on greffe deux computeds réels (`confirmedBalance` via le moteur Phase 1, `projectedBalance` = confirmé + `forecastDelta` filtré par `isRecurrencePosted`). Les deux soldes existants (`currentBalance`/`endOfMonthBalance`) sont remplacés ; les libellés i18n sont reframés.

**Tech Stack:** Angular 20 (signals, computed, OnPush, zoneless), Vitest via `ng test` (+ `TestBed.overrideComponent`), Transloco i18n.

---

## Périmètre

- **Inclus :** plomberie des transactions réelles dans `bank-account.ts`, computeds `confirmedBalance`/`projectedBalance`/`forecastDelta`, repointage des bindings template (`bank-kpi-grid` + `bank-timeline`), reframe des libellés i18n, spec composant.
- **Exclus (plans suivants) :** auto-postage (Plan 3) — la limitation « double comptage si saisie manuelle d'une récurrence » est assumée ici ; unification vocabulaire catégories ; migration virements ponctuels.

## Structure des fichiers

- Modify: `src/app/features/budget/pages/bank-account/bank-account.ts` — injection gateway, signaux/computeds réels, repointage template, retrait des 2 anciens computeds.
- Create: `src/app/features/budget/pages/bank-account/bank-account.spec.ts` — spec composant (réconciliation).
- Modify: `public/i18n/fr.json` + `public/i18n/en.json` — libellés des 2 cartes de solde.

Le provider `AccountTransactionGateway` est déjà câblé (Phase 1, `app.config.ts`).

---

## Task 1 : Plomberie des transactions réelles + `confirmedBalance` (TDD)

**Files:**
- Modify: `src/app/features/budget/pages/bank-account/bank-account.ts`
- Test: `src/app/features/budget/pages/bank-account/bank-account.spec.ts`

> On ajoute le solde confirmé **à côté** des computeds existants (qui restent) — le composant compile et l'ancien comportement est intact jusqu'à la Task 3.

- [ ] **Step 1 : Écrire le spec rouge**

```ts
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { RecurringEntryGateway } from '../../domain/gateways/recurring-entry.gateway';
import { BankAccountGateway } from '../../domain/gateways/bank-account.gateway';
import { MemberGateway } from '../../domain/gateways/member.gateway';
import { SalaryArchiveGateway } from '../../domain/gateways/salary-archive.gateway';
import { AccountTransactionGateway } from '../../domain/gateways/account-transaction.gateway';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm.service';
import { TranslocoService } from '@jsverse/transloco';
import { BankAccount } from './bank-account';

type Cmp = {
  confirmedBalance: () => number;
  projectedBalance: () => number;
  selectAccount: (id: string | null) => void;
};

const ACCOUNTS = [
  { id: 'a', name: 'Courant', type: 'courant', initialBalance: 1000, color: null, dotColor: null },
];

function makeComponent(opts: { entries?: unknown[]; txs?: unknown[] } = {}) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      { provide: RecurringEntryGateway, useValue: { getAll: () => of(opts.entries ?? []) } },
      { provide: BankAccountGateway, useValue: { getAll: () => of(ACCOUNTS) } },
      { provide: MemberGateway, useValue: { getAll: () => of([]) } },
      { provide: SalaryArchiveGateway, useValue: { getAll: () => of([]) } },
      { provide: AccountTransactionGateway, useValue: { getAll: () => of(opts.txs ?? []) } },
      { provide: Toaster, useValue: { success: () => {}, error: () => {}, info: () => {} } },
      { provide: ConfirmService, useValue: { ask: () => of(true) } },
      { provide: TranslocoService, useValue: { translate: (k: string) => k, getActiveLang: () => 'fr' } },
    ],
  });
  TestBed.overrideComponent(BankAccount, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(BankAccount);
  fixture.detectChanges();
  return fixture.componentInstance as unknown as Cmp;
}

describe('BankAccount — solde confirmé', () => {
  it('confirmedBalance = solde initial quand aucune transaction réelle', () => {
    const cmp = makeComponent();
    expect(cmp.confirmedBalance()).toBe(1000);
  });

  it('confirmedBalance reflète les transactions réelles (initial + revenu − dépense)', () => {
    const txs = [
      { id: 't1', accountId: 'a', amount: 200, direction: 'income', toAccountId: null, date: '2000-01-01', category: null, note: null, memberId: null, recurringEntryId: null },
      { id: 't2', accountId: 'a', amount: 50, direction: 'expense', toAccountId: null, date: '2000-01-02', category: null, note: null, memberId: null, recurringEntryId: null },
    ];
    const cmp = makeComponent({ txs });
    expect(cmp.confirmedBalance()).toBe(1150);
  });
});
```

> Le `ConfirmService`/`Toaster`/`TranslocoService` ne sont pas appelés par les computeds testés ; les stubs minimaux suffisent. CRITICAL : avant d'écrire, **vérifier les chemins d'import réels** de `Toaster`, `ConfirmService` et des gateways en ouvrant l'en-tête de `bank-account.ts` (les chemins ci-dessus sont basés dessus mais confirme-les ; ajuste si besoin).

- [ ] **Step 2 : Lancer (échec attendu)**

Run: `cd dash-flow && ng test --include '**/bank-account.spec.ts'`
Expected: FAIL — `confirmedBalance` n'existe pas sur le composant.

- [ ] **Step 3 : Ajouter les imports en tête de `bank-account.ts`**

Après les imports de gateways existants, ajouter :
```ts
import { AccountTransactionGateway } from '../../domain/gateways/account-transaction.gateway';
import { AccountTransaction } from '../../domain/models/account-transaction.model';
import { confirmedBalance as computeConfirmedBalance, isRecurrencePosted } from '../../domain/account-balance';
import { addMoney } from '../../domain/money';
```

- [ ] **Step 4 : Injecter la gateway + signaux/computeds réels**

À côté des autres `inject(...)` (vers la ligne 281) :
```ts
private readonly txGateway = inject(AccountTransactionGateway);
```
Près de `allEntries` (toSignal) :
```ts
private readonly allTx = toSignal(this.txGateway.getAll(), { initialValue: [] as AccountTransaction[] });
private readonly todayIso = new Date().toISOString().slice(0, 10);
```
Après le computed `selectedAccount` (vers la ligne 436) :
```ts
protected readonly accountRealTxs = computed(() => {
  const id = this.selectedAccountId();
  const txs = this.allTx();
  if (id === null) return txs;
  return txs.filter((t) => t.accountId === id || t.toAccountId === id);
});

protected readonly confirmedBalance = computed(() => {
  const acc = this.selectedAccount();
  if (acc) return computeConfirmedBalance(acc, this.accountRealTxs(), this.todayIso);
  // « Tous les comptes » : agrégat (les virements inter-comptes propres se compensent)
  const txs = this.allTx();
  return this.accounts().reduce(
    (sum, a) => addMoney(sum, computeConfirmedBalance(a, txs.filter((t) => t.accountId === a.id || t.toAccountId === a.id), this.todayIso)),
    0,
  );
});
```

> `computeConfirmedBalance` est l'alias d'import du `confirmedBalance` de domaine (évite le shadowing avec le computed). `BankAccount` (modèle) a bien `initialBalance: number` et `id: string`, compatibles avec la signature `{ initialBalance: number; id?: string }`.

- [ ] **Step 5 : Lancer (vert attendu)**

Run: `cd dash-flow && ng test --include '**/bank-account.spec.ts'`
Expected: PASS (2 tests).

- [ ] **Step 6 : Commit**

```bash
git add src/app/features/budget/pages/bank-account/bank-account.ts src/app/features/budget/pages/bank-account/bank-account.spec.ts
git commit -m "feat(budget): solde confirmé (transactions réelles) sur le dashboard

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 : `forecastDelta` + `projectedBalance` (TDD)

**Files:**
- Modify: `src/app/features/budget/pages/bank-account/bank-account.ts`
- Test: `src/app/features/budget/pages/bank-account/bank-account.spec.ts`

- [ ] **Step 1 : Ajouter les tests rouges (non-régression + exclusion des postées)**

Ajouter dans le spec un bloc, avec une récurrence de dépense mensuelle :
```ts
describe('BankAccount — solde projeté', () => {
  const RENT = { id: 'r1', accountId: 'a', label: 'Loyer', amount: 800, type: 'expense', dayOfMonth: 5, date: null, endDate: null, toAccountId: null, category: null, memberId: null };

  it('projeté = confirmé + delta des récurrences (zéro transaction réelle)', () => {
    const cmp = makeComponent({ entries: [RENT] });
    // confirmé = 1000 (initial), delta = -800 (loyer non posté) → projeté = 200
    expect(cmp.confirmedBalance()).toBe(1000);
    expect(cmp.projectedBalance()).toBe(200);
  });

  it('une récurrence postée (transaction réelle de même recurringEntryId ce mois) est exclue du delta', () => {
    const month = new Date().toISOString().slice(0, 7);
    // Daté au 1er du mois : toujours ≤ aujourd'hui (donc compté dans confirmedBalance)
    // ET même mois que currentMonth (donc détecté comme posté par isRecurrencePosted).
    const posted = { id: 'tx', accountId: 'a', amount: 800, direction: 'expense', toAccountId: null, date: `${month}-01`, category: null, note: null, memberId: null, recurringEntryId: 'r1' };
    const cmp = makeComponent({ entries: [RENT], txs: [posted] });
    // confirmé = 1000 − 800 = 200 (la dépense réelle) ; delta = 0 (loyer posté, exclu) → projeté = 200
    expect(cmp.confirmedBalance()).toBe(200);
    expect(cmp.projectedBalance()).toBe(200);
  });
});
```

> Les deux scénarios convergent vers un projeté de 200 € par deux chemins (prévision pure vs réel posté) — c'est exactement la propriété anti-double-comptage. Le `type`/`dayOfMonth` du modèle `RecurringEntry` : confirmer les noms de champs réels en ouvrant `domain/models/recurring-entry.model.ts` et ajuster le littéral `RENT` si besoin (champs requis manquants → compile error).

- [ ] **Step 2 : Lancer (échec attendu)**

Run: `cd dash-flow && ng test --include '**/bank-account.spec.ts'`
Expected: FAIL — `projectedBalance` n'existe pas.

- [ ] **Step 3 : Ajouter `isUnposted` + `forecastDelta` + `projectedBalance`**

Après le computed `confirmedBalance` :
```ts
private readonly isUnposted = (e: RecurringEntry): boolean =>
  !isRecurrencePosted(e.id, this.currentMonth, this.accountRealTxs());

// Delta des récurrences = formule de endOfMonthBalance SANS le solde initial,
// chaque somme excluant les récurrences déjà postées (réconciliées avec une transaction réelle).
protected readonly forecastDelta = computed(() => {
  const inc = sumAmount(this.incomes().filter(this.isUnposted));
  const exp = sumAmount(this.monthlyExpenses().filter(this.isUnposted));
  const ann = sumAmount(this.annualExpenses().filter(this.isUnposted)) / 12;
  const spend = sumAmount(this.monthSpendings().filter(this.isUnposted));
  const inTransfers = sumAmount(this.incomingTransfers().filter(this.isUnposted)) + this.totalOneTimeIncoming();
  const outTransfers = sumAmount(this.outgoingTransfers().filter(this.isUnposted)) + this.totalOneTimeOutgoing();
  return inc + inTransfers - exp - ann - spend - outTransfers;
});

protected readonly projectedBalance = computed(() => this.confirmedBalance() + this.forecastDelta());
```

> `incomingTransfers`/`outgoingTransfers` sont `private` (même classe → accessibles). Les virements **ponctuels** (`totalOneTimeIncoming/Outgoing`) ne sont pas filtrés par `isUnposted` (jamais postés ; toujours dans la projection) — cohérent avec le design. Avec zéro transaction réelle, `isUnposted` est toujours vrai → `forecastDelta` == `endOfMonthBalance − selectedInitialBalance` (non-régression exacte).

- [ ] **Step 4 : Lancer (vert attendu)**

Run: `cd dash-flow && ng test --include '**/bank-account.spec.ts'`
Expected: PASS (4 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/app/features/budget/pages/bank-account/bank-account.ts src/app/features/budget/pages/bank-account/bank-account.spec.ts
git commit -m "feat(budget): solde projeté = confirmé + récurrences non postées

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 : Repointer le template + retirer les anciens computeds

**Files:**
- Modify: `src/app/features/budget/pages/bank-account/bank-account.ts`

- [ ] **Step 1 : Repointer les bindings template**

Dans le template de `bank-account.ts` :
- `app-bank-kpi-grid` : remplacer `[currentBalance]="currentBalance()"` par `[currentBalance]="confirmedBalance()"` et `[endOfMonthBalance]="endOfMonthBalance()"` par `[endOfMonthBalance]="projectedBalance()"`.
- `app-bank-timeline` : remplacer `[currentBalance]="currentBalance()"` par `[currentBalance]="confirmedBalance()"`.

> On conserve les noms d'inputs des composants enfants (`currentBalance`/`endOfMonthBalance`) : ce ne sont que des conteneurs d'affichage ; seules les valeurs et les libellés (Task 4) changent. Churn minimal.

- [ ] **Step 2 : Retirer les deux anciens computeds**

Supprimer les computeds `currentBalance` (≈ l. 483-488) et `endOfMonthBalance` (≈ l. 490-494) — ils ne sont plus référencés (vérifier : `grep -n 'currentBalance\|endOfMonthBalance' src/app/features/budget/pages/bank-account/bank-account.ts` ne doit plus montrer que les bindings d'inputs des enfants, lesquels portent désormais `confirmedBalance()`/`projectedBalance()`). Les sommes de support (`totalPassedExpenses`, `totalUpcomingExpenses`, `passedIncoming`, `passedOutgoing`, etc.) restent — utilisées par `budget-usage-bar` et les labels.

- [ ] **Step 3 : Build + suite ciblée**

Run: `cd dash-flow && pnpm build && ng test --include '**/bank-account.spec.ts'`
Expected: build PASS (plus de référence à `currentBalance`/`endOfMonthBalance` dans le composant), 4 tests PASS.

- [ ] **Step 4 : Commit**

```bash
git add src/app/features/budget/pages/bank-account/bank-account.ts
git commit -m "refactor(budget): dashboard affiche confirmé/projeté au lieu du prévisionnel

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4 : Reframe des libellés i18n

**Files:**
- Modify: `public/i18n/fr.json`
- Modify: `public/i18n/en.json`

- [ ] **Step 1 : Mettre à jour fr.json** (clés sous `budget.bankAccount.kpi`, ≈ l. 620-632)

```
"balance": "Solde confirmé",
"balanceAt": "réel au {{date}}",
...
"endOfCycle": "Projeté (fin de mois)",
"endOfCycleSub": "confirmé + à venir"
```

- [ ] **Step 2 : Mettre à jour en.json** (mêmes clés)

```
"balance": "Confirmed balance",
"balanceAt": "real as of {{date}}",
...
"endOfCycle": "Projected (end of month)",
"endOfCycleSub": "confirmed + upcoming"
```

> Ne modifier QUE ces 4 valeurs. Ne pas toucher `budget.bankAccount.accountModal.currentBalance` (« Solde initial », clé distincte, l. 697 fr).

- [ ] **Step 3 : Build**

Run: `cd dash-flow && pnpm build`
Expected: PASS.

- [ ] **Step 4 : Commit**

```bash
git add public/i18n/fr.json public/i18n/en.json
git commit -m "i18n(budget): libellés solde confirmé / projeté

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5 : Vérification finale

**Files:** aucun (vérification).

- [ ] **Step 1 : Suite front complète**

Run: `cd dash-flow && ng test`
Expected: PASS (les specs existants + les nouveaux ; aucun n'asserte les anciens `currentBalance`/`endOfMonthBalance` — confirmé : aucun `bank-account.spec.ts` ne préexistait).

- [ ] **Step 2 : Build prod**

Run: `cd dash-flow && pnpm build`
Expected: PASS.

- [ ] **Step 3 : Smoke navigateur (compte démo)**

Monter la stack (back :3001 + `ng serve` :4200 + DB up) et piloter via le compte démo (cf. `reference_dashflow_demo_verif`) :
1. `/budget/dashboard` (ou la page compte) → les deux cartes affichent désormais **« Solde confirmé »** et **« Projeté (fin de mois) »**. Sans transaction réelle, le projeté doit égaler l'ancien solde fin de cycle (non-régression).
2. Aller au Relevé (`/budget/transactions`), ajouter une dépense réelle, revenir au dashboard → **le solde confirmé a baissé du montant** (le projeté reste cohérent).
Zéro erreur console hors `401 /auth/me` initial (bénin).

---

## Vérification de fin de plan

- [ ] `ng test` complet vert.
- [ ] `pnpm build` vert.
- [ ] Smoke : dashboard montre confirmé + projeté ; non-régression du projeté sans transaction ; le confirmé bouge après une saisie au Relevé.
- [ ] Commits sur master (non poussés).

## Notes pour les plans suivants

- **Plan 3 (auto-postage)** : `PendingChargesPanel` qui pose `recurringEntryId` sur la transaction créée → résout la limitation « double comptage si saisie manuelle d'une récurrence ». Ajoutera `monthReconciliation` si besoin d'un détail par échéance.
- **Différés** : unification vocabulaire catégories (clé vs label) ; migration virements ponctuels → `account_transactions`.
