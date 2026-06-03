# Tier 1 « effet Money » — Phase 4 : Import CSV — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠️ Commits.** Deux repos : front `dash-flow` (gros) + back `nest-dashflow-app` (endpoint batch). Pour CETTE exécution l'utilisateur a autorisé l'auto-commit sur `master` (jamais de push) — règle « no auto-commit J-Ned » levée. Les étapes « Commit » s'exécutent réellement. Commits séparés par repo.

**Goal:** Importer un relevé bancaire CSV : parsing front (E2EE), mapping de colonnes, revue (dédup + catégories), insertion en lot via un endpoint batch.

**Architecture:** Domaine pur front (parse/dedup/categorize) + endpoint backend batch + gateway `createBatch` (chiffre chaque item, un POST) + assistant modal `CsvImportWizard` sur le Relevé.

**Tech Stack:** Angular 20 (signals, OnPush), Vitest via `ng test` ; NestJS + Drizzle + Zod + Vitest (back).

---

## Structure des fichiers
- Create (front domain): `src/app/features/budget/domain/models/parsed-transaction.model.ts`, `domain/csv-import.ts`, `domain/import-dedup.ts`, `domain/import-categorize.ts` (+ specs).
- Modify (front): `domain/gateways/account-transaction.gateway.ts`, `infra/http-account-transaction.gateway.ts` (+ spec), `pages/transactions/transactions.ts`, `public/i18n/{fr,en}.json`.
- Create (front UI): `pages/transactions/csv-import-wizard/csv-import-wizard.ts` (+ spec).
- Modify (back): `modules/account-transactions/dto/account-transaction.dto.ts`, `account-transactions.service.ts` (+ spec), `account-transactions.controller.ts`.

---

## Task 1 : `domain/csv-import.ts` + type (TDD, front)

**Files:**
- Create: `src/app/features/budget/domain/models/parsed-transaction.model.ts`
- Create: `src/app/features/budget/domain/csv-import.ts`
- Test: `src/app/features/budget/domain/csv-import.spec.ts`

> Commits autorisés sur master pour cette exécution — exécute réellement `git commit`.

- [ ] **Step 1 : type**

`parsed-transaction.model.ts` :
```ts
export type ParsedTransaction = {
  readonly date: string;
  readonly label: string;
  readonly amount: number;
  readonly direction: 'income' | 'expense';
};

export type CsvMapping = {
  readonly dateCol: number;
  readonly labelCol: number;
  readonly amountMode:
    | { readonly kind: 'signed'; readonly col: number }
    | { readonly kind: 'debitCredit'; readonly debitCol: number; readonly creditCol: number };
  readonly dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY';
};
```

- [ ] **Step 2 : spec rouge**

`csv-import.spec.ts` :
```ts
import { parseCsv, parseAmount, parseDate, mapRows } from './csv-import';

describe('parseCsv', () => {
  it('détecte le séparateur point-virgule et lit l\'en-tête', () => {
    const r = parseCsv('Date;Libellé;Montant\n01/06/2026;Courses;-42,50');
    expect(r.headers).toEqual(['Date', 'Libellé', 'Montant']);
    expect(r.rows).toEqual([['01/06/2026', 'Courses', '-42,50']]);
  });
  it('gère la virgule comme séparateur', () => {
    const r = parseCsv('Date,Label,Amount\n2026-06-01,Rent,-800');
    expect(r.rows[0]).toEqual(['2026-06-01', 'Rent', '-800']);
  });
});

describe('parseAmount', () => {
  it.each([
    ['-42,50', -42.5], ['1 234,56', 1234.56], ['1234.56', 1234.56], ['(50,00)', -50], ['+12', 12],
  ])('parse %s → %s', (raw, expected) => { expect(parseAmount(raw)).toBe(expected); });
});

describe('parseDate', () => {
  it('DD/MM/YYYY', () => { expect(parseDate('01/06/2026', 'DD/MM/YYYY')).toBe('2026-06-01'); });
  it('YYYY-MM-DD passthrough', () => { expect(parseDate('2026-06-01', 'YYYY-MM-DD')).toBe('2026-06-01'); });
  it('MM/DD/YYYY', () => { expect(parseDate('06/01/2026', 'MM/DD/YYYY')).toBe('2026-06-01'); });
});

describe('mapRows', () => {
  const rows = [['01/06/2026', 'Courses', '-42,50'], ['28/06/2026', 'Salaire', '2850']];
  it('colonne signée → direction selon le signe, montant positif', () => {
    const out = mapRows(rows, { dateCol: 0, labelCol: 1, amountMode: { kind: 'signed', col: 2 }, dateFormat: 'DD/MM/YYYY' });
    expect(out).toEqual([
      { date: '2026-06-01', label: 'Courses', amount: 42.5, direction: 'expense' },
      { date: '2026-06-28', label: 'Salaire', amount: 2850, direction: 'income' },
    ]);
  });
  it('débit/crédit séparés', () => {
    const dc = [['01/06/2026', 'Courses', '42,50', ''], ['28/06/2026', 'Salaire', '', '2850']];
    const out = mapRows(dc, { dateCol: 0, labelCol: 1, amountMode: { kind: 'debitCredit', debitCol: 2, creditCol: 3 }, dateFormat: 'DD/MM/YYYY' });
    expect(out[0]).toEqual({ date: '2026-06-01', label: 'Courses', amount: 42.5, direction: 'expense' });
    expect(out[1]).toEqual({ date: '2026-06-28', label: 'Salaire', amount: 2850, direction: 'income' });
  });
});
```

- [ ] **Step 3 : run, confirm FAIL** — `ng test --include '**/csv-import.spec.ts'`.

- [ ] **Step 4 : implémenter `csv-import.ts`**
```ts
import { ParsedTransaction, CsvMapping } from './models/parsed-transaction.model';

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const delim = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const split = (line: string) => line.split(delim).map((c) => c.trim().replace(/^"(.*)"$/, '$1'));
  return { headers: split(lines[0]), rows: lines.slice(1).map(split) };
}

export function parseAmount(raw: string): number {
  const neg = /^\(.*\)$/.test(raw.trim()) || raw.trim().startsWith('-');
  const cleaned = raw.replace(/[()\s]/g, '').replace(/[^0-9.,-]/g, '');
  // dernière virgule/point = séparateur décimal ; on retire les milliers
  const norm = cleaned.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.').replace(/-/g, '');
  const n = Number(norm) || 0;
  return neg ? -n : n;
}

export function parseDate(raw: string, format: CsvMapping['dateFormat']): string {
  const t = raw.trim();
  if (format === 'YYYY-MM-DD') return t.slice(0, 10);
  const [a, b, y] = t.split(/[/.-]/);
  const dd = format === 'DD/MM/YYYY' ? a : b;
  const mm = format === 'DD/MM/YYYY' ? b : a;
  return `${y}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

export function mapRows(rows: string[][], m: CsvMapping): ParsedTransaction[] {
  return rows.map((r) => {
    let amount: number;
    if (m.amountMode.kind === 'signed') amount = parseAmount(r[m.amountMode.col] ?? '0');
    else {
      const debit = parseAmount(r[m.amountMode.debitCol] ?? '0');
      const credit = parseAmount(r[m.amountMode.creditCol] ?? '0');
      amount = credit !== 0 ? Math.abs(credit) : -Math.abs(debit);
    }
    return {
      date: parseDate(r[m.dateCol] ?? '', m.dateFormat),
      label: r[m.labelCol] ?? '',
      amount: Math.abs(amount),
      direction: amount >= 0 ? 'income' : 'expense',
    };
  });
}
```
> ⚠️ `parseAmount` : la regex de milliers est délicate — si un test échoue sur un cas (ex. `1.234,56`), ajuste l'ordre de nettoyage plutôt que de bricoler les attentes. Garder les cas du spec comme vérité.

- [ ] **Step 5 : run, confirm PASS.**
- [ ] **Step 6 : commit** — `feat(budget): parsing CSV d'import (csv-import domain)`

---

## Task 2 : dédup + catégorisation (TDD, front)

**Files:**
- Create: `src/app/features/budget/domain/import-dedup.ts` (+ `.spec.ts`)
- Create: `src/app/features/budget/domain/import-categorize.ts` (+ `.spec.ts`)

- [ ] **Step 1 : spec rouge dédup** (`import-dedup.spec.ts`)
```ts
import { markDuplicates } from './import-dedup';
import { ParsedTransaction } from './models/parsed-transaction.model';

const p = (date: string, label: string, amount: number): ParsedTransaction => ({ date, label, amount, direction: 'expense' });

describe('markDuplicates', () => {
  it('marque doublon si une transaction existante a même date+montant+libellé', () => {
    const existing = [{ date: '2026-06-01', amount: 42.5, note: 'Courses' }];
    const out = markDuplicates([p('2026-06-01', 'Courses', 42.5), p('2026-06-02', 'Essence', 60)], existing as never);
    expect(out[0].duplicate).toBe(true);
    expect(out[1].duplicate).toBe(false);
  });
});
```
> La fonction compare l'empreinte ; les "existing" exposent `date`, `amount`, et un libellé (`note` ou `label`). Adapter la lecture du libellé existant au modèle réel `AccountTransaction` (champ `note`).

- [ ] **Step 2 : run FAIL** — `ng test --include '**/import-dedup.spec.ts'`.

- [ ] **Step 3 : implémenter `import-dedup.ts`**
```ts
import { ParsedTransaction } from './models/parsed-transaction.model';

const fold = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

export function fingerprint(date: string, amount: number, label: string | null): string {
  return `${date}|${amount}|${fold(label)}`;
}

export type ExistingTx = { date: string; amount: number; note: string | null };

export function markDuplicates(
  parsed: readonly ParsedTransaction[],
  existing: readonly ExistingTx[],
): (ParsedTransaction & { duplicate: boolean })[] {
  const seen = new Set(existing.map((e) => fingerprint(e.date, e.amount, e.note)));
  return parsed.map((t) => ({ ...t, duplicate: seen.has(fingerprint(t.date, t.amount, t.label)) }));
}
```

- [ ] **Step 4 : run PASS.**

- [ ] **Step 5 : spec rouge catégorisation** (`import-categorize.spec.ts`)
```ts
import { suggestCategory } from './import-categorize';

describe('suggestCategory', () => {
  it.each([
    ['CARREFOUR MARKET', 'food'], ['Virement loyer', 'housing'], ['SNCF BILLET', 'transport'],
    ['Cotisation NETFLIX', 'subscription'], ['Truc inconnu xyz', 'other'],
  ])('« %s » → %s', (label, code) => { expect(suggestCategory(label)).toBe(code); });
});
```
> Adapter les codes attendus aux clés réelles de `categories.ts` (`food`/`housing`/`transport`/`subscription`/`other` existent — vérifier). Ajuste les libellés d'exemple si une règle diffère, mais garde au moins un cas par règle + le fallback.

- [ ] **Step 6 : run FAIL.**

- [ ] **Step 7 : implémenter `import-categorize.ts`**
```ts
const RULES: readonly { readonly re: RegExp; readonly code: string }[] = [
  { re: /carrefour|leclerc|auchan|lidl|intermarch|monoprix|course|restau|boulanger/i, code: 'food' },
  { re: /loyer|rent|edf|engie|eau|gaz|charges/i, code: 'housing' },
  { re: /sncf|ratp|uber|essence|carburant|total|peage|train|billet/i, code: 'transport' },
  { re: /netflix|spotify|abonnement|cotisation|free|sfr|orange|bouygues/i, code: 'subscription' },
  { re: /assurance|mutuelle|maif|macif|axa/i, code: 'insurance' },
  { re: /pharmacie|m[ée]decin|docteur|sant[ée]|hopital/i, code: 'health' },
];

export function suggestCategory(label: string): string {
  return RULES.find((r) => r.re.test(label))?.code ?? 'other';
}
```
> Les codes doivent exister dans `categories.ts` (`BudgetCategoryKey`). Vérifier `insurance`/`health` présents (ils le sont d'après le référentiel A2).

- [ ] **Step 8 : run PASS.**
- [ ] **Step 9 : commit** — `feat(budget): dédup et catégorisation d'import (domain)`

---

## Task 3 : Backend batch + gateway front `createBatch` (TDD)

**Files (back):**
- Modify: `nest-dashflow-app/src/modules/account-transactions/dto/account-transaction.dto.ts`
- Modify: `nest-dashflow-app/src/modules/account-transactions/account-transactions.service.ts` (+ `.spec.ts`)
- Modify: `nest-dashflow-app/src/modules/account-transactions/account-transactions.controller.ts`

**Files (front):**
- Modify: `dash-flow/src/app/features/budget/domain/gateways/account-transaction.gateway.ts`
- Modify: `dash-flow/src/app/features/budget/infra/http-account-transaction.gateway.ts` (+ `.spec.ts`)

### Backend

- [ ] **Step 1 : DTO** — ajouter dans `account-transaction.dto.ts` :
```ts
export const batchTransactionSchema = z.object({
  items: z.array(z.record(z.string(), z.unknown())).min(1).max(1000),
});
export type BatchTransactionDto = z.infer<typeof batchTransactionSchema>;
```
> Les items sont validés finement par le mapping du service (comme le create), pas ici — on borne juste la taille. (Cohérent avec le controller create qui parse selon `encryptedData`.)

- [ ] **Step 2 : test service rouge** — ajouter à `account-transactions.service.spec.ts` :
```ts
it('addBatch refuse si le compte n\'appartient pas à l\'utilisateur', async () => {
  const fakeDb = { select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }) };
  const moduleRef = await Test.createTestingModule({
    providers: [AccountTransactionsService, { provide: DRIZZLE, useValue: fakeDb }],
  }).compile();
  const svc = moduleRef.get(AccountTransactionsService);
  const res = await svc.addBatch('u1', 'acc-x', [{ amount: '10', direction: 'expense', date: '2026-06-01' }]);
  expect(res).toBeUndefined();
});
```

- [ ] **Step 3 : run FAIL** — `cd nest-dashflow-app && pnpm test account-transactions.service`.

- [ ] **Step 4 : implémenter `addBatch`** dans le service (à côté de `addTransaction`) :
```ts
async addBatch(userId: string, accountId: string, items: NewTransactionValues[]) {
  if (!(await this.ownsAccount(userId, accountId))) return undefined;
  if (items.length === 0) return [];
  return this.db.insert(accountTransactions)
    .values(items.map((v) => ({ ...v, userId, accountId }))).returning();
}
```
(`NewTransactionValues` est le type explicite déjà défini en Phase 1 pour `addTransaction`. `ownsAccount` existe.)

- [ ] **Step 5 : run PASS.**

- [ ] **Step 6 : route controller** — ajouter dans `account-transactions.controller.ts` :
```ts
@UseGuards(CsrfGuard) @Post('bank-accounts/:accountId/transactions/batch') @HttpCode(201)
async createBatch(@CurrentUser() u: AuthUser, @Param('accountId') accountId: string, @Body() body: Record<string, unknown>) {
  const { items } = parseBody(batchTransactionSchema, body);
  const mapped = items.map((raw) => {
    if (raw.encryptedData) {
      return { amount: '0', date: new Date().toISOString().slice(0, 10),
        direction: raw.direction, toAccountId: raw.toAccountId ?? null,
        memberId: raw.memberId ?? null, recurringEntryId: raw.recurringEntryId ?? null,
        encryptedData: raw.encryptedData } as NewTransactionValues & { encryptedData: string };
    }
    const d = parseBody(createTransactionSchema, raw);
    return { amount: d.amount, direction: d.direction, date: d.date,
      toAccountId: d.toAccountId ?? null, category: d.category ?? null, note: d.note ?? null,
      memberId: d.memberId ?? null, recurringEntryId: d.recurringEntryId ?? null };
  });
  const rows = await this.svc.addBatch(u.id, accountId, mapped as never);
  if (rows === undefined) throw new NotFoundException('Compte non trouvé');
  return rows;
}
```
Importer `batchTransactionSchema`. Le static `transactions/batch` est sous `bank-accounts/:accountId/transactions/batch` — placer la méthode près du POST create. `NewTransactionValues` est exporté du service ou redéfini ; si non exporté, accepter `Record<string, unknown>[]` côté service (le service caste déjà). Adapter au plus simple qui compile.

- [ ] **Step 7 : build + test back** — `pnpm build && pnpm test` → PASS (67 + nouveau).
- [ ] **Step 8 : commit (back)** — `feat(account-transactions): endpoint batch d'insertion`

### Front gateway

- [ ] **Step 9 : interface** — ajouter à `account-transaction.gateway.ts` :
```ts
abstract createBatch(accountId: string, items: Omit<AccountTransaction, 'id' | 'accountId'>[]): Observable<AccountTransaction[]>;
```

- [ ] **Step 10 : spec rouge** — ajouter à `http-account-transaction.gateway.spec.ts` (réutilise `waitForRequest`/`BASE`) :
```ts
it('createBatch poste un tableau (plaintext)', () => {
  let n = 0;
  gateway.createBatch('acc-1', [
    { amount: 10, direction: 'expense', toAccountId: null, date: '2026-06-01', category: 'food', note: null, memberId: null, recurringEntryId: null },
    { amount: 20, direction: 'income', toAccountId: null, date: '2026-06-02', category: null, note: null, memberId: null, recurringEntryId: null },
  ]).subscribe((rows) => (n = rows.length));
  const req = httpMock.expectOne(`${BASE}/bank-accounts/acc-1/transactions/batch`);
  expect(req.request.body.items.length).toBe(2);
  req.flush([{ id: 'a' }, { id: 'b' }]);
  expect(n).toBe(2);
});
```
(placer dans le describe plaintext.)

- [ ] **Step 11 : run FAIL.**

- [ ] **Step 12 : implémenter `createBatch`** dans `http-account-transaction.gateway.ts` :
```ts
createBatch(accountId: string, items: Omit<AccountTransaction, 'id' | 'accountId'>[]): Observable<AccountTransaction[]> {
  const key = this.crypto.getMasterKey();
  const url = `/bank-accounts/${accountId}/transactions/batch`;
  if (!key) return this.api.post<AccountTransaction[]>(url, { items });
  return from(Promise.all(items.map((it) => encryptEntity(it as Record<string, unknown>, CLEARTEXT_KEYS, key)))).pipe(
    switchMap((encrypted) => this.api.post<AccountTransaction[]>(url, { items: encrypted })),
  );
}
```
Importer `from`, `switchMap` de `rxjs` et `encryptEntity` de `@core/services/crypto/entity-crypto` (vérifier le chemin exact, déjà utilisé par crypto-transport). `CLEARTEXT_KEYS` est déjà la const du fichier.

- [ ] **Step 13 : run PASS** (plaintext ; l'E2EE est couvert par le pattern create déjà testé).
- [ ] **Step 14 : commit (front)** — `feat(budget): gateway createBatch (import en lot)`

---

## Task 4 : Assistant `CsvImportWizard` + intégration Relevé (TDD)

**Files:**
- Create: `dash-flow/src/app/features/budget/pages/transactions/csv-import-wizard/csv-import-wizard.ts` (+ `.spec.ts`)
- Modify: `dash-flow/src/app/features/budget/pages/transactions/transactions.ts`
- Modify: `dash-flow/public/i18n/{fr,en}.json`

- [ ] **Step 1 : spec rouge composant** — `csv-import-wizard.spec.ts` (teste le cœur : importer les lignes cochées) :
```ts
import { TestBed } from '@angular/core/testing';
import { CsvImportWizard } from './csv-import-wizard';

describe('CsvImportWizard', () => {
  it('importExpose émet seulement les lignes cochées non-doublons', () => {
    const fixture = TestBed.createComponent(CsvImportWizard);
    const cmp = fixture.componentInstance as unknown as {
      reviewRows: { set: (r: unknown[]) => void };
      toImport: () => unknown[];
    };
    cmp.reviewRows.set([
      { date: '2026-06-01', label: 'Courses', amount: 42.5, direction: 'expense', category: 'food', duplicate: false, selected: true },
      { date: '2026-06-02', label: 'Dup', amount: 10, direction: 'expense', category: 'other', duplicate: true, selected: false },
    ]);
    expect(cmp.toImport().length).toBe(1);
  });
});
```

- [ ] **Step 2 : run FAIL** — `ng test --include '**/csv-import-wizard.spec.ts'`.

- [ ] **Step 3 : implémenter `CsvImportWizard`** — composant signal, 3 étapes. Squelette complet :
```ts
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { AccountTransactionGateway } from '../../../domain/gateways/account-transaction.gateway';
import { parseCsv, mapRows } from '../../../domain/csv-import';
import { CsvMapping } from '../../../domain/models/parsed-transaction.model';
import { markDuplicates, ExistingTx } from '../../../domain/import-dedup';
import { suggestCategory } from '../../../domain/import-categorize';
import { CATEGORY_GROUPS } from '../../../domain/categories';

type ReviewRow = { date: string; label: string; amount: number; direction: 'income' | 'expense'; category: string; duplicate: boolean; selected: boolean };

@Component({
  selector: 'app-csv-import-wizard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslocoPipe],
  template: `... (3 étapes, voir notes) ...`,
})
export class CsvImportWizard {
  private readonly _txGateway = inject(AccountTransactionGateway);
  readonly accountId = input.required<string>();
  readonly existing = input<ExistingTx[]>([]);
  readonly imported = output<number>();

  protected readonly step = signal<1 | 2 | 3>(1);
  protected readonly headers = signal<string[]>([]);
  protected readonly rawRows = signal<string[][]>([]);
  protected readonly mapping = signal<CsvMapping>({ dateCol: 0, labelCol: 1, amountMode: { kind: 'signed', col: 2 }, dateFormat: 'DD/MM/YYYY' });
  protected readonly reviewRows = signal<ReviewRow[]>([]);
  protected readonly categoryGroups = CATEGORY_GROUPS;

  protected onFile(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result));
      this.headers.set(parsed.headers); this.rawRows.set(parsed.rows); this.step.set(2);
    };
    reader.readAsText(file);
  }

  protected buildReview(): void {
    const mapped = mapRows(this.rawRows(), this.mapping());
    const flagged = markDuplicates(mapped, this.existing());
    this.reviewRows.set(flagged.map((t) => ({ ...t, category: suggestCategory(t.label), selected: !t.duplicate })));
    this.step.set(3);
  }

  protected toImport(): ReviewRow[] { return this.reviewRows().filter((r) => r.selected); }

  protected setRow(i: number, patch: Partial<ReviewRow>): void {
    this.reviewRows.update((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  protected runImport(): void {
    const rows = this.toImport();
    if (rows.length === 0) return;
    this._txGateway.createBatch(this.accountId(), rows.map((r) => ({
      amount: r.amount, direction: r.direction, toAccountId: null, date: r.date,
      category: r.category, note: null, memberId: null, recurringEntryId: null,
    }))).subscribe(() => this.imported.emit(rows.length));
  }
}
```
Template (3 étapes via `@if (step() === n)`), classes token existantes :
- Étape 1 : `<input type="file" accept=".csv" (change)="onFile($event)">`.
- Étape 2 : pour chaque champ (date/libellé/montant), un `<select>` listant `headers()` (valeur = index) lié au `mapping()` ; un `<select>` format date ; bouton « Aperçu » → `buildReview()`. (Pour le MVP, mode `signed` uniquement dans l'UI ; le mode débitCredit existe en domaine pour plus tard — OU exposer un toggle. Garder simple : `signed`.)
- Étape 3 : `<table>`/`<ul>` des `reviewRows()` : checkbox `[ngModel]="r.selected"`, date, libellé, montant, `<select>` catégorie (depuis `categoryGroups` en `<optgroup>`) `(ngModelChange)="setRow(i, {category: $event})"`, badge si `r.duplicate`. Bouton `[disabled]="toImport().length === 0"` « Importer {{ toImport().length }} » → `runImport()`.

> Le spec ne teste que `reviewRows`/`toImport` (cœur). Les `protected` exposés au test via cast. `ExistingTx` importé du module dédup.

- [ ] **Step 4 : run PASS.**

- [ ] **Step 5 : intégrer dans `transactions.ts` (Relevé)** :
  - Importer `CsvImportWizard` + `app-modal-dialog` (vérifier le pattern modal du repo, cf. `bank-account.ts` qui utilise `<app-modal-dialog #x>` + `viewChild.required<ModalDialog>`).
  - Ajouter un bouton « Importer un relevé » près de l'en-tête, ouvrant la modale.
  - Dans la modale : `<app-csv-import-wizard [accountId]="currentAccount()?.id ?? ''" [existing]="existingForImport()" (imported)="onImported($event)" />`.
  - `existingForImport` computed = `allTx()` du compte mappé en `{date, amount, note}`.
  - `onImported(n)` : fermer la modale + `reload()` (le Relevé a déjà `reload()` depuis Phase 1) + toast succès optionnel.
- [ ] **Step 6 : i18n** — clés `budget.transactions.import.*` (fr/en) : `button` (« Importer un relevé »/« Import statement »), `step1`, `step2`, `step3`, `mapDate`, `mapLabel`, `mapAmount`, `dateFormat`, `preview`, `duplicate`, `confirm` (« Importer {{count}} »/« Import {{count}} »). Valider JSON.
- [ ] **Step 7 : build + suites ciblées** — `cd dash-flow && pnpm build && ng test --include '**/csv-import*.spec.ts' --include '**/transactions.spec.ts'` → PASS.
- [ ] **Step 8 : commit (front)** — `feat(budget): assistant d'import CSV sur le Relevé`

---

## Task 5 : Vérification finale

- [ ] **Step 1 : suite back** — `cd nest-dashflow-app && pnpm test` → PASS.
- [ ] **Step 2 : suite front** — `cd dash-flow && ng test` → PASS (relancer 2× pour stabilité anti-flake).
- [ ] **Step 3 : builds** — back + front `pnpm build` → PASS.
- [ ] **Step 4 : smoke navigateur (démo)** : Relevé → « Importer un relevé » → choisir un petit CSV (créer un fichier `/tmp/demo.csv` ex. `Date;Libellé;Montant\n01/06/2026;CARREFOUR;-42,50\n02/06/2026;VIREMENT;100`) → mapping (date=0,libellé=1,montant=2, format DD/MM/YYYY) → aperçu : 2 lignes, catégories suggérées (food / other), pas de doublon → importer → le Relevé montre les 2 mouvements, le solde confirmé bouge. Réimporter le même fichier → les 2 lignes marquées **doublon** (décochées). Nettoyer (supprimer les transactions ou reset démo). Zéro erreur console hors `401 /auth/me`.

## Vérification de fin de plan
- [ ] Back `pnpm test`+`build` verts ; front `ng test`+`build` verts (stables).
- [ ] Smoke : import → preview/dédup/catégories → insertion batch → solde bouge ; ré-import → doublons.
- [ ] Commits séparés back/front sur master (non poussés).

## Notes
- Termine le Tier 1 « effet Money » (registre, dashboard réconcilié, auto-postage, import).
- Différés restants : OFX, unification vocabulaire catégories (clé vs label), migration virements ponctuels, bug i18n mois, error-handling `confirmAllCharges`.
