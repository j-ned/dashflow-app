# Tier 1 « effet Money » — Phase 3 : Auto-postage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠️ Commits.** Repo unique : front `dash-flow`. Pour CETTE exécution l'utilisateur a autorisé l'auto-commit sur `master` (jamais de push) — règle mémoire « no auto-commit J-Ned » levée ici. Les étapes « Commit » s'exécutent réellement.

**Goal:** Un panneau « Échéances à confirmer » en haut de la page Compte transforme une récurrence échue (income/expense/transfer datés, non postés) en transaction réelle portant `recurringEntryId`, fermant la boucle de réconciliation.

**Architecture:** Composant dumb `PendingChargesPanel` (liste + montant éditable + confirmer/ignorer) alimenté par un computed `pendingCharges` du smart `BankAccount`. Confirmer crée une transaction via le gateway et recharge ; ignorer = set de session. `allTx` devient rechargeable.

**Tech Stack:** Angular 20 (signals, linkedSignal, OnPush, zoneless), Transloco, Vitest via `ng test`.

---

## Structure des fichiers
- Create: `src/app/features/budget/domain/pending-charge.ts` — type `PendingCharge`.
- Create: `src/app/features/budget/pages/bank-account/pending-charges-panel/pending-charges-panel.ts` (+ `.spec.ts`) — composant dumb.
- Modify: `src/app/features/budget/pages/bank-account/bank-account.ts` — `allTx` rechargeable, `_ignoredCharges`, `pendingCharges`, handlers, rendu, type import.
- Modify: `public/i18n/fr.json` + `public/i18n/en.json` — clés `budget.bankAccount.pending.*`.

---

## Task 1 : Type `PendingCharge` + composant `PendingChargesPanel` (TDD)

**Files:**
- Create: `src/app/features/budget/domain/pending-charge.ts`
- Create: `src/app/features/budget/pages/bank-account/pending-charges-panel/pending-charges-panel.ts`
- Test: `src/app/features/budget/pages/bank-account/pending-charges-panel/pending-charges-panel.spec.ts`

> Commits autorisés sur master pour cette exécution — exécute réellement `git commit`.

- [ ] **Step 1 : Créer le type**

`domain/pending-charge.ts` :
```ts
import { RecurringEntry } from './models/recurring-entry.model';

export type PendingCharge = {
  readonly entry: RecurringEntry;
  readonly direction: 'income' | 'expense' | 'transfer';
  readonly suggestedDate: string;
  readonly suggestedAmount: number;
};
```
CRITICAL : confirmer le chemin réel du modèle `RecurringEntry` en ouvrant `src/app/features/budget/domain/models/recurring-entry.model.ts` ; ajuster l'import si besoin.

- [ ] **Step 2 : Écrire le spec rouge**

`pending-charges-panel.spec.ts` :
```ts
import { TestBed } from '@angular/core/testing';
import { PendingChargesPanel } from './pending-charges-panel';
import { PendingCharge } from '../../../domain/pending-charge';

function charge(id: string, amount: number): PendingCharge {
  return {
    entry: { id, accountId: 'a', label: 'Loyer', amount, type: 'expense', dayOfMonth: 5, date: null, endDate: null, toAccountId: null, category: null, memberId: null, payslipKey: null } as PendingCharge['entry'],
    direction: 'expense', suggestedDate: '2026-06-05', suggestedAmount: amount,
  };
}

describe('PendingChargesPanel', () => {
  it('émet confirm avec le montant suggéré', () => {
    const fixture = TestBed.createComponent(PendingChargesPanel);
    fixture.componentRef.setInput('charges', [charge('r1', 800)]);
    fixture.componentRef.setInput('accountNameById', () => null);
    fixture.detectChanges();
    let emitted: { id: string; amount: number } | undefined;
    fixture.componentInstance.confirm.subscribe((e) => (emitted = e));
    const btn = fixture.nativeElement.querySelector('[data-testid="confirm-r1"]') as HTMLButtonElement;
    btn.click();
    expect(emitted).toEqual({ id: 'r1', amount: 800 });
  });

  it('émet ignore avec l\'id', () => {
    const fixture = TestBed.createComponent(PendingChargesPanel);
    fixture.componentRef.setInput('charges', [charge('r1', 800)]);
    fixture.componentRef.setInput('accountNameById', () => null);
    fixture.detectChanges();
    let ignored: string | undefined;
    fixture.componentInstance.ignore.subscribe((id) => (ignored = id));
    (fixture.nativeElement.querySelector('[data-testid="ignore-r1"]') as HTMLButtonElement).click();
    expect(ignored).toBe('r1');
  });

  it('ne rend rien quand la liste est vide', () => {
    const fixture = TestBed.createComponent(PendingChargesPanel);
    fixture.componentRef.setInput('charges', []);
    fixture.componentRef.setInput('accountNameById', () => null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="pending-panel"]')).toBeNull();
  });
});
```

- [ ] **Step 3 : Lancer (échec attendu)**

Run: `cd dash-flow && ng test --include '**/pending-charges-panel.spec.ts'`
Expected: FAIL — composant introuvable.

- [ ] **Step 4 : Implémenter le composant**

```ts
import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PendingCharge } from '../../../domain/pending-charge';

@Component({
  selector: 'app-pending-charges-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, FormsModule],
  host: { class: 'block' },
  template: `
    @if (charges().length > 0) {
      <section data-testid="pending-panel" class="rounded-xl border border-ib-orange/40 bg-surface p-4 mb-4">
        <div class="flex items-center justify-between mb-3">
          <p class="text-sm font-semibold">{{ 'budget.bankAccount.pending.title' | transloco }} ({{ charges().length }})</p>
          <button type="button" data-testid="confirm-all"
                  class="text-xs px-2 py-1 rounded-lg bg-ib-orange text-canvas"
                  (click)="confirmAll.emit()">{{ 'budget.bankAccount.pending.confirmAll' | transloco }}</button>
        </div>
        <ul class="divide-y divide-border/40">
          @for (c of charges(); track c.entry.id) {
            <li class="flex items-center justify-between gap-3 py-2">
              <span class="text-sm">{{ c.entry.label }}
                <span class="text-text-muted text-xs">{{ 'budget.bankAccount.pending.dueOn' | transloco: { date: c.suggestedDate } }}</span>
              </span>
              <span class="flex items-center gap-2">
                <input type="number" step="0.01"
                       class="w-24 rounded-lg border border-border bg-canvas px-2 py-1 text-sm text-right"
                       [ngModel]="amounts()[c.entry.id]" (ngModelChange)="setAmount(c.entry.id, $event)" />
                <button type="button" [attr.data-testid]="'confirm-' + c.entry.id"
                        class="text-xs px-2 py-1 rounded-lg bg-ib-green/15 text-ib-green"
                        (click)="confirm.emit({ id: c.entry.id, amount: amounts()[c.entry.id] })">{{ 'budget.bankAccount.pending.confirm' | transloco }}</button>
                <button type="button" [attr.data-testid]="'ignore-' + c.entry.id"
                        class="text-xs px-2 py-1 rounded-lg text-text-muted"
                        (click)="ignore.emit(c.entry.id)">{{ 'budget.bankAccount.pending.ignore' | transloco }}</button>
              </span>
            </li>
          }
        </ul>
      </section>
    }
  `,
})
export class PendingChargesPanel {
  readonly charges = input.required<PendingCharge[]>();
  readonly accountNameById = input.required<(id: string | null) => string | null>();
  readonly confirm = output<{ id: string; amount: number }>();
  readonly confirmAll = output<void>();
  readonly ignore = output<string>();

  protected readonly amounts = linkedSignal<Record<string, number>>(() =>
    Object.fromEntries(this.charges().map((c) => [c.entry.id, c.suggestedAmount])),
  );

  protected setAmount(id: string, value: number): void {
    this.amounts.update((m) => ({ ...m, [id]: value }));
  }
}
```
> Ajouter `TranslocoPipe` aux `imports` du composant (le template utilise `| transloco`). CRITICAL : vérifier le nom/chemin réel du pipe Transloco utilisé ailleurs (`import { TranslocoPipe } from '@jsverse/transloco'`) et l'ajouter aux imports + au tableau `imports` du décorateur.

- [ ] **Step 5 : Lancer (vert attendu)**

Run: `cd dash-flow && ng test --include '**/pending-charges-panel.spec.ts'`
Expected: PASS (3 tests).

- [ ] **Step 6 : Commit**
```bash
git add src/app/features/budget/domain/pending-charge.ts src/app/features/budget/pages/bank-account/pending-charges-panel/
git commit -m "feat(budget): composant PendingChargesPanel (échéances à confirmer)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 : Intégration dans `bank-account.ts` (TDD)

**Files:**
- Modify: `src/app/features/budget/pages/bank-account/bank-account.ts`
- Modify: `src/app/features/budget/pages/bank-account/bank-account.spec.ts`
- Modify: `public/i18n/fr.json` + `public/i18n/en.json`

- [ ] **Step 1 : Ajouter les tests rouges au bank-account.spec.ts**

```ts
describe('BankAccount — échéances à confirmer', () => {
  const month = new Date().toISOString().slice(0, 7);
  // dayOfMonth=1 → toujours échu (cycle salaire), non posté tant qu'aucune tx ne porte r1 ce mois
  const RENT = { id: 'r1', accountId: 'a', label: 'Loyer', amount: 800, type: 'expense', dayOfMonth: 1, date: null, endDate: null, toAccountId: null, category: null, memberId: null, payslipKey: null };

  it('pendingCharges inclut une dépense récurrente échue et non postée', () => {
    const cmp = makeComponent({ entries: [RENT] }) as unknown as { pendingCharges: () => unknown[] };
    expect(cmp.pendingCharges().length).toBe(1);
  });

  it('pendingCharges exclut une récurrence déjà postée ce mois', () => {
    const posted = { id: 'tx', accountId: 'a', amount: 800, direction: 'expense', toAccountId: null, date: `${month}-01`, category: null, note: null, memberId: null, recurringEntryId: 'r1' };
    const cmp = makeComponent({ entries: [RENT], txs: [posted] }) as unknown as { pendingCharges: () => unknown[] };
    expect(cmp.pendingCharges().length).toBe(0);
  });

  it('ignoreCharge retire l\'échéance de la liste', () => {
    const cmp = makeComponent({ entries: [RENT] }) as unknown as { pendingCharges: () => unknown[]; ignoreCharge: (id: string) => void };
    expect(cmp.pendingCharges().length).toBe(1);
    cmp.ignoreCharge('r1');
    expect(cmp.pendingCharges().length).toBe(0);
  });
});
```
> `RENT.dayOfMonth = 1` garantit `isExpensePassed` vrai quel que soit le jour (jour 1 toujours « passé » dans le cycle). Confirmer les champs requis de `RecurringEntry` (déjà fait en Phase 2 : `payslipKey` requis).

- [ ] **Step 2 : Lancer (échec attendu)**

Run: `cd dash-flow && ng test --include '**/bank-account.spec.ts'`
Expected: FAIL — `pendingCharges`/`ignoreCharge` absents.

- [ ] **Step 3 : Rendre `allTx` rechargeable**

Remplacer la ligne (Phase 2) :
```ts
private readonly allTx = toSignal(this.txGateway.getAll(), { initialValue: [] as AccountTransaction[] });
```
par :
```ts
private readonly _refreshTx = signal(0);
private readonly allTx = toSignal(
  toObservable(this._refreshTx).pipe(switchMap(() => this.txGateway.getAll())),
  { initialValue: [] as AccountTransaction[] },
);
private refreshTx(): void { this._refreshTx.update((n) => n + 1); }
```
(`toObservable`, `switchMap`, `signal` sont déjà importés dans ce fichier — vérifier ; sinon ajouter.)

- [ ] **Step 4 : Ajouter `_ignoredCharges`, `pendingCharges`, handlers**

Importer le type + le gateway create est déjà injecté (`txGateway`). Ajouter :
```ts
import { PendingCharge } from '../../domain/pending-charge';
```
Dans la classe (après les computeds de solde) :
```ts
private readonly _ignoredCharges = signal<ReadonlySet<string>>(new Set());

protected readonly pendingCharges = computed<PendingCharge[]>(() => {
  const ignored = this._ignoredCharges();
  const candidates = [
    ...this.incomes(),
    ...this.monthlyExpenses(),
    ...this.recurringTransfers(),
  ];
  return candidates
    .filter((e) => e.dayOfMonth != null && this.isExpensePassed(e) && this.isUnposted(e) && !ignored.has(e.id))
    .map((e) => ({
      entry: e,
      direction: e.type === 'income' ? 'income' : e.type === 'transfer' ? 'transfer' : 'expense',
      suggestedDate: `${this.currentMonth}-${String(e.dayOfMonth).padStart(2, '0')}`,
      suggestedAmount: Number(e.amount),
    }));
});

protected confirmCharge(id: string, amount: number): void {
  const charge = this.pendingCharges().find((c) => c.entry.id === id);
  if (!charge) return;
  const e = charge.entry;
  this.txGateway.create(e.accountId!, {
    amount, direction: charge.direction, date: charge.suggestedDate,
    toAccountId: e.toAccountId, category: e.category, note: null,
    memberId: e.memberId, recurringEntryId: e.id,
  }).pipe(takeUntilDestroyed(this._destroyRef)).subscribe(() => this.refreshTx());
}

protected confirmAllCharges(): void {
  const charges = this.pendingCharges();
  let remaining = charges.length;
  if (remaining === 0) return;
  for (const c of charges) {
    const e = c.entry;
    this.txGateway.create(e.accountId!, {
      amount: c.suggestedAmount, direction: c.direction, date: c.suggestedDate,
      toAccountId: e.toAccountId, category: e.category, note: null,
      memberId: e.memberId, recurringEntryId: e.id,
    }).pipe(takeUntilDestroyed(this._destroyRef)).subscribe(() => { if (--remaining === 0) this.refreshTx(); });
  }
}

protected ignoreCharge(id: string): void {
  this._ignoredCharges.update((s) => new Set(s).add(id));
}
```
> `_destroyRef` : injecter `private readonly _destroyRef = inject(DestroyRef);` (import `DestroyRef` de `@angular/core`, `takeUntilDestroyed` de `@angular/core/rxjs-interop`) s'ils ne sont pas déjà présents. `e.accountId!` : `RecurringEntry.accountId` est nullable dans le modèle mais une échéance candidate a toujours un compte (filtrée) ; si TS se plaint, garder le `!`. `Number(e.amount)` : les montants peuvent être string en clair (coercition).

- [ ] **Step 5 : Lancer (vert attendu)**

Run: `cd dash-flow && ng test --include '**/bank-account.spec.ts'`
Expected: PASS (les 4 tests Phase 2 + les 3 nouveaux = 7).

- [ ] **Step 6 : Rendre le panneau + i18n**

Dans le template de `bank-account.ts`, **juste avant** `<app-bank-kpi-grid ...>` :
```html
<app-pending-charges-panel
  [charges]="pendingCharges()"
  [accountNameById]="accountNameByIdFn"
  (confirm)="confirmCharge($event.id, $event.amount)"
  (confirmAll)="confirmAllCharges()"
  (ignore)="ignoreCharge($event)" />
```
Ajouter `PendingChargesPanel` aux `imports` du décorateur `@Component` (importer la classe en tête).

Ajouter dans `public/i18n/fr.json` sous `budget.bankAccount` (à côté de `kpi`) :
```json
"pending": {
  "title": "Échéances à confirmer",
  "confirm": "Confirmer",
  "confirmAll": "Tout confirmer",
  "ignore": "Ignorer",
  "dueOn": "échéance du {{date}}"
}
```
Et dans `public/i18n/en.json` :
```json
"pending": {
  "title": "Charges to confirm",
  "confirm": "Confirm",
  "confirmAll": "Confirm all",
  "ignore": "Dismiss",
  "dueOn": "due {{date}}"
}
```
> Insérer l'objet `pending` en respectant la syntaxe JSON (virgules). Vérifier que les deux fichiers parsent (`node -e "JSON.parse(require('fs').readFileSync('public/i18n/fr.json','utf8'))"`).

- [ ] **Step 7 : Build + suite ciblée**

Run: `cd dash-flow && pnpm build && ng test --include '**/bank-account.spec.ts' --include '**/pending-charges-panel.spec.ts'`
Expected: build PASS, tests PASS.

- [ ] **Step 8 : Commit**
```bash
git add src/app/features/budget/pages/bank-account/bank-account.ts src/app/features/budget/pages/bank-account/bank-account.spec.ts public/i18n/fr.json public/i18n/en.json
git commit -m "feat(budget): échéances à confirmer sur la page Compte (auto-postage)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 : Vérification finale

- [ ] **Step 1 : Suite front complète** — `cd dash-flow && ng test` → PASS (stable ; relancer 2× si doute de flake).
- [ ] **Step 2 : Build** — `cd dash-flow && pnpm build` → PASS.
- [ ] **Step 3 : Smoke navigateur (démo)** : page Compte → le panneau « Échéances à confirmer » liste les prélèvements/revenus échus du mois. Confirmer une échéance → le solde confirmé bouge du montant, l'échéance disparaît du panneau. Ignorer une autre → disparaît. Nettoyer (supprimer les transactions créées au Relevé ou compter sur le reset démo 6h). Zéro erreur console hors `401 /auth/me`.

## Vérification de fin de plan
- [ ] `ng test` complet vert + `pnpm build` vert.
- [ ] Smoke : panneau visible, confirmation poste + recharge + déplace le solde confirmé, ignore masque.
- [ ] Commits sur master (non poussés).

## Notes
- Ferme la dette Phase 2 (double comptage) : une échéance confirmée porte `recurringEntryId` → exclue du projeté.
- Reste : Plan 4 (import OFX/CSV). Différés : unification catégories, migration virements ponctuels, bug i18n mois.
