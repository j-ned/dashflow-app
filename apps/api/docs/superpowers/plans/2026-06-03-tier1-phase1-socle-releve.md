# Tier 1 « effet Money » — Phase 1 : Socle & Relevé — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠️ Contrainte chantier J-Ned — commits délégués.** NE JAMAIS exécuter `git add` / `git commit` / `git push`. Les étapes « Commit » signifient : **proposer le message à l'utilisateur**, qui commit lui-même. Back (`nest-dashflow-app`) et front (`dash-flow`) sont **deux repos distincts** → un commit ne touche jamais les deux.

**Goal:** Doter DashFlow d'un registre de transactions bancaires réelles (E2EE) avec une vue « Relevé » autonome (CRUD manuel + solde confirmé réel), sans toucher au dashboard existant.

**Architecture:** Backend NestJS = coffre aveugle (table de blobs `encryptedData`, calquée sur `loan_transactions`). Front Angular = toute l'intelligence : gateway E2EE (crypto-transport), taxonomie de catégories en code, moteur pur `account-balance` (`confirmedBalance`), et une page Relevé autonome.

**Tech Stack:** NestJS, Drizzle ORM + postgres-js, Zod, Vitest (back) ; Angular 20 (signals, zoneless, OnPush), RxJS, crypto WebCrypto, Vitest + `@angular/build:unit-test` (front), Tailwind v4.

---

## Périmètre de ce plan

- **Inclus :** table + migration `0004`, module backend `account-transactions`, modèles + gateway front, taxonomie catégories, moteur `confirmedBalance` + helper anti-double-postage, page Relevé (liste + CRUD + solde confirmé par compte).
- **Exclus (plans suivants) :** bascule du dashboard `bank-account.ts` (Plan 2), auto-postage `PendingChargesPanel` (Plan 3), import OFX/CSV (Plan 4), `projectedBalance`/`monthReconciliation` complets (Plan 2/3).

## Structure des fichiers

**Backend `nest-dashflow-app` :**
- Modify: `src/db/schema/finance.ts` — enum `transaction_direction` + table `account_transactions`.
- Create: `src/db/migrations/0004_*.sql` — généré par `pnpm db:generate`.
- Create: `src/modules/account-transactions/dto/account-transaction.dto.ts`
- Create: `src/modules/account-transactions/account-transactions.service.ts` (+ `.spec.ts`)
- Create: `src/modules/account-transactions/account-transactions.controller.ts`
- Create: `src/modules/account-transactions/account-transactions.module.ts`
- Modify: `src/app.module.ts` — enregistrer le module.

**Front `dash-flow` :**
- Create: `src/app/features/budget/domain/models/account-transaction.model.ts`
- Create: `src/app/features/budget/domain/gateways/account-transaction.gateway.ts`
- Create: `src/app/features/budget/infra/http-account-transaction.gateway.ts` (+ `.spec.ts`)
- Modify: `src/app/features/budget/domain/categories.ts` (+ `categories.spec.ts` créé)
- Create: `src/app/features/budget/domain/account-balance.ts` (+ `.spec.ts`)
- Create: `src/app/features/budget/pages/transactions/transactions.ts` (+ `.spec.ts`)
- Modify: la config de routes budget + le câblage du provider gateway (`app.config.ts` ou provider de route).

---

## Task 1 : Schéma Drizzle — enum + table `account_transactions`

**Files:**
- Modify: `nest-dashflow-app/src/db/schema/finance.ts`

- [ ] **Step 1 : Ajouter l'enum de direction**

Dans `finance.ts`, après `bankAccountTypeEnum` (ligne ~9) :

```ts
export const transactionDirectionEnum = pgEnum('transaction_direction', ['income', 'expense', 'transfer']);
```

- [ ] **Step 2 : Ajouter la table après `bankAccounts`**

```ts
export const accountTransactions = pgTable('account_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => bankAccounts.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull().default('0'),
  direction: transactionDirectionEnum('direction').notNull().default('expense'),
  toAccountId: uuid('to_account_id').references(() => bankAccounts.id, { onDelete: 'set null' }),
  date: date('date').notNull(),
  category: varchar('category', { length: 100 }),
  note: varchar('note', { length: 255 }),
  memberId: uuid('member_id').references(() => patients.id, { onDelete: 'set null' }),
  recurringEntryId: uuid('recurring_entry_id').references(() => recurringEntries.id, { onDelete: 'set null' }),
  encryptedData: text('encrypted_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

> Note : `recurringEntries` est défini plus bas dans le même fichier — la référence en arrow function (`() => recurringEntries.id`) est résolue paresseusement, donc l'ordre de déclaration n'importe pas.

- [ ] **Step 3 : Build de vérification**

Run: `cd nest-dashflow-app && pnpm build`
Expected: PASS (compilation TS OK, table typée).

- [ ] **Step 4 : Commit (délégué)**

Proposer à l'utilisateur (repo back) :
`feat(database): ajoute la table account_transactions et l'enum transaction_direction`

---

## Task 2 : Migration `0004`

**Files:**
- Create: `nest-dashflow-app/src/db/migrations/0004_*.sql` (généré)

- [ ] **Step 1 : Générer la migration depuis le schéma**

Run: `cd nest-dashflow-app && pnpm db:generate`
Expected: création d'un fichier `src/db/migrations/0004_<nom>.sql` contenant `CREATE TYPE "public"."transaction_direction"` + `CREATE TABLE "account_transactions"`.

- [ ] **Step 2 : Inspecter le SQL généré**

Run: `ls src/db/migrations/ && sed -n '1,40p' src/db/migrations/0004_*.sql`
Expected: le `CREATE TABLE` reprend toutes les colonnes de Task 1 + les FK. Vérifier qu'aucun `DROP` non idempotent n'est présent (cf. piège migration au boot).

- [ ] **Step 3 : Appliquer sur la DB de dev**

Run: `pnpm db:migrate`
Expected: « applied 0004 » (ou équivalent), pas d'erreur. La baseline 0000→0003 doit déjà être présente.

- [ ] **Step 4 : Vérifier la table en base**

Run: `psql "$DATABASE_URL" -c '\d account_transactions'` (ou via `make` / podman selon l'environnement local)
Expected: la table existe avec les 12 colonnes.

- [ ] **Step 5 : Commit (délégué)**

Proposer (repo back) : `feat(database): migration 0004 account_transactions`

> ⚠️ **Ordre prod (à l'étape déploiement, pas maintenant)** : adoption baseline si pas faite → `migrate` (applique 0004) → déployer le backend. Sinon un SELECT sur une table absente = 500.

---

## Task 3 : DTO Zod

**Files:**
- Create: `nest-dashflow-app/src/modules/account-transactions/dto/account-transaction.dto.ts`

- [ ] **Step 1 : Écrire les schémas**

```ts
import { z } from 'zod';

const optionalUuid = z.string().uuid().nullable().optional();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)');
const amount = z.union([z.string(), z.number()]).transform(String);

const DIRECTIONS = ['income', 'expense', 'transfer'] as const;

export const createTransactionSchema = z.object({
  amount,
  direction: z.enum(DIRECTIONS),
  toAccountId: optionalUuid,
  date: dateStr,
  category: z.string().max(100).nullable().optional(),
  note: z.string().max(255).nullable().optional(),
  memberId: optionalUuid,
  recurringEntryId: optionalUuid,
});

export const createEncryptedTransactionSchema = z.object({
  direction: z.enum(DIRECTIONS),
  toAccountId: optionalUuid,
  memberId: optionalUuid,
  recurringEntryId: optionalUuid,
  encryptedData: z.string().min(1),
});

export type CreateTransactionDto = z.infer<typeof createTransactionSchema>;
export type CreateEncryptedTransactionDto = z.infer<typeof createEncryptedTransactionSchema>;
```

> `accountId` n'est PAS dans le body : il vient du paramètre de route `/bank-accounts/:accountId/transactions`.

- [ ] **Step 2 : Build de vérification**

Run: `cd nest-dashflow-app && pnpm build`
Expected: PASS.

- [ ] **Step 3 : Commit (délégué)** — `feat(account-transactions): DTO Zod de création`

---

## Task 4 : Service (TDD)

**Files:**
- Create: `nest-dashflow-app/src/modules/account-transactions/account-transactions.service.ts`
- Test: `nest-dashflow-app/src/modules/account-transactions/account-transactions.service.spec.ts`

- [ ] **Step 1 : Écrire le test rouge**

```ts
import { Test } from '@nestjs/testing';
import { DRIZZLE } from '../../db/drizzle.constants';
import { AccountTransactionsService } from './account-transactions.service';

describe('AccountTransactionsService', () => {
  it('refuse d\'ajouter une transaction sur un compte qui n\'appartient pas à l\'utilisateur', async () => {
    // Given : aucun compte ne matche (userId, accountId)
    const fakeDb = {
      select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [AccountTransactionsService, { provide: DRIZZLE, useValue: fakeDb }],
    }).compile();
    const svc = moduleRef.get(AccountTransactionsService);

    // When
    const result = await svc.addTransaction('user-1', 'acc-x', {
      amount: '10', direction: 'expense', date: '2026-06-01',
    });

    // Then
    expect(result).toBeUndefined();
  });
});
```

- [ ] **Step 2 : Lancer le test (échec attendu)**

Run: `cd nest-dashflow-app && pnpm test account-transactions.service`
Expected: FAIL — module `account-transactions.service` introuvable.

- [ ] **Step 3 : Implémenter le service**

```ts
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { accountTransactions, bankAccounts } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';

type AccountTransaction = typeof accountTransactions.$inferSelect;

@Injectable()
export class AccountTransactionsService extends OwnedCrudService<AccountTransaction> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) { super(db, accountTransactions); }

  listOfAccount(userId: string, accountId: string) {
    return this.db.select().from(accountTransactions)
      .where(and(eq(accountTransactions.userId, userId), eq(accountTransactions.accountId, accountId)))
      .orderBy(desc(accountTransactions.date), desc(accountTransactions.createdAt)).limit(500);
  }

  listAll(userId: string) {
    return this.db.select().from(accountTransactions)
      .where(eq(accountTransactions.userId, userId)).limit(1000);
  }

  private async ownsAccount(userId: string, accountId: string): Promise<boolean> {
    const rows = await this.db.select().from(bankAccounts)
      .where(and(eq(bankAccounts.id, accountId), eq(bankAccounts.userId, userId))).limit(1);
    return rows.length > 0;
  }

  async addTransaction(
    userId: string,
    accountId: string,
    values: Partial<typeof accountTransactions.$inferInsert>,
  ) {
    if (!(await this.ownsAccount(userId, accountId))) return undefined;
    const rows = await this.db.insert(accountTransactions)
      .values({ ...values, userId, accountId } as typeof accountTransactions.$inferInsert).returning();
    return rows[0];
  }
}
```

- [ ] **Step 4 : Lancer le test (vert attendu)**

Run: `cd nest-dashflow-app && pnpm test account-transactions.service`
Expected: PASS.

- [ ] **Step 5 : Commit (délégué)** — `feat(account-transactions): service avec contrôle de propriété du compte`

---

## Task 5 : Controller

**Files:**
- Create: `nest-dashflow-app/src/modules/account-transactions/account-transactions.controller.ts`

- [ ] **Step 1 : Implémenter le controller**

```ts
import {
  Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Put, UseGuards,
} from '@nestjs/common';
import { AccountTransactionsService } from './account-transactions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import { createTransactionSchema, createEncryptedTransactionSchema } from './dto/account-transaction.dto';

const today = (): string => new Date().toISOString().slice(0, 10);

@UseGuards(JwtAuthGuard)
@Controller()
export class AccountTransactionsController {
  constructor(private readonly svc: AccountTransactionsService) {}

  @Get('transactions/all')
  listAll(@CurrentUser() u: AuthUser) { return this.svc.listAll(u.id); }

  @Get('bank-accounts/:accountId/transactions')
  listOfAccount(@CurrentUser() u: AuthUser, @Param('accountId') accountId: string) {
    return this.svc.listOfAccount(u.id, accountId);
  }

  @UseGuards(CsrfGuard) @Post('bank-accounts/:accountId/transactions') @HttpCode(201)
  async create(
    @CurrentUser() u: AuthUser,
    @Param('accountId') accountId: string,
    @Body() body: Record<string, unknown>,
  ) {
    if (body.encryptedData) {
      const d = parseBody(createEncryptedTransactionSchema, body);
      const row = await this.svc.addTransaction(u.id, accountId, {
        amount: '0', date: today(),
        direction: d.direction, toAccountId: d.toAccountId ?? null,
        memberId: d.memberId ?? null, recurringEntryId: d.recurringEntryId ?? null,
        encryptedData: d.encryptedData,
      });
      if (row === undefined) throw new NotFoundException('Compte non trouvé');
      return row;
    }
    const d = parseBody(createTransactionSchema, body);
    const row = await this.svc.addTransaction(u.id, accountId, {
      amount: d.amount, direction: d.direction, date: d.date,
      toAccountId: d.toAccountId ?? null, category: d.category ?? null, note: d.note ?? null,
      memberId: d.memberId ?? null, recurringEntryId: d.recurringEntryId ?? null,
    });
    if (row === undefined) throw new NotFoundException('Compte non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard) @Put('transactions/:id')
  async update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    let patch: Record<string, unknown>;
    if (body.encryptedData) {
      patch = { encryptedData: body.encryptedData };
      for (const k of ['direction', 'toAccountId', 'memberId', 'recurringEntryId'] as const) {
        if (body[k] !== undefined) patch[k] = body[k];
      }
    } else {
      const { id: _i, userId: _u, accountId: _a, createdAt: _c, ...rest } = body;
      patch = rest;
    }
    const row = await this.svc.update(u.id, id, patch);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard) @Delete('transactions/:id') @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.svc.remove(u.id, id);
  }
}
```

> Route statique `transactions/all` déclarée avant les routes paramétrées (pas de collision ici car préfixes différents, mais cohérent avec le pattern loans).

- [ ] **Step 2 : Build**

Run: `cd nest-dashflow-app && pnpm build`
Expected: PASS.

- [ ] **Step 3 : Commit (délégué)** — `feat(account-transactions): controller (list/create/update/delete)`

---

## Task 6 : Module + enregistrement

**Files:**
- Create: `nest-dashflow-app/src/modules/account-transactions/account-transactions.module.ts`
- Modify: `nest-dashflow-app/src/app.module.ts`

- [ ] **Step 1 : Créer le module**

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AccountTransactionsController } from './account-transactions.controller';
import { AccountTransactionsService } from './account-transactions.service';

@Module({
  imports: [AuthModule],
  controllers: [AccountTransactionsController],
  providers: [AccountTransactionsService],
})
export class AccountTransactionsModule {}
```

> Vérifier le chemin d'import de `AuthModule` en s'alignant sur `loans.module.ts` (`../../auth/auth.module`).

- [ ] **Step 2 : Enregistrer dans `app.module.ts`**

Ajouter `AccountTransactionsModule` à la liste des `imports` (à côté de `LoansModule`). Reproduire exactement le style d'import existant.

- [ ] **Step 3 : Démarrer l'API et vérifier le mapping des routes**

Run: `cd nest-dashflow-app && pnpm start:dev` (puis observer les logs de boot)
Expected: les routes `GET /transactions/all`, `GET /bank-accounts/:accountId/transactions`, `POST /bank-accounts/:accountId/transactions`, `PUT /transactions/:id`, `DELETE /transactions/:id` sont mappées. Arrêter ensuite (`Ctrl-C`).

- [ ] **Step 4 : Lancer toute la suite back**

Run: `pnpm test`
Expected: PASS (les 66 tests existants + le nouveau).

- [ ] **Step 5 : Commit (délégué)** — `feat(account-transactions): enregistre le module`

---

## Task 7 : Modèle front `AccountTransaction`

**Files:**
- Create: `dash-flow/src/app/features/budget/domain/models/account-transaction.model.ts`

- [ ] **Step 1 : Écrire le modèle**

```ts
export type TransactionDirection = 'income' | 'expense' | 'transfer';

export type AccountTransaction = {
  readonly id: string;
  readonly accountId: string;
  readonly amount: number;
  readonly direction: TransactionDirection;
  readonly toAccountId: string | null;
  readonly date: string;
  readonly category: string | null;
  readonly note: string | null;
  readonly memberId: string | null;
  readonly recurringEntryId: string | null;
};
```

- [ ] **Step 2 : Commit (délégué, repo front)** — `feat(budget): modèle AccountTransaction`

---

## Task 8 : Gateway front (interface + HTTP + spec, TDD)

**Files:**
- Create: `dash-flow/src/app/features/budget/domain/gateways/account-transaction.gateway.ts`
- Create: `dash-flow/src/app/features/budget/infra/http-account-transaction.gateway.ts`
- Test: `dash-flow/src/app/features/budget/infra/http-account-transaction.gateway.spec.ts`

- [ ] **Step 1 : Interface (abstract class — cohérent avec les autres gateways budget)**

```ts
import { Observable } from 'rxjs';
import { AccountTransaction } from '../models/account-transaction.model';

export abstract class AccountTransactionGateway {
  abstract getForAccount(accountId: string): Observable<AccountTransaction[]>;
  abstract getAll(): Observable<AccountTransaction[]>;
  abstract create(accountId: string, data: Omit<AccountTransaction, 'id' | 'accountId'>): Observable<AccountTransaction>;
  abstract update(id: string, data: Partial<Omit<AccountTransaction, 'id'>>): Observable<AccountTransaction>;
  abstract delete(id: string): Observable<void>;
}
```

- [ ] **Step 2 : Écrire le spec rouge (plaintext + E2EE)**

Mimer `http-envelope.gateway.spec.ts`. Plaintext : `getForAccount` coerce `amount` en number. E2EE (clé `crypto.subtle.generateKey`) : `create` chiffre `amount`/`date`/`category`/`note` et déchiffre la réponse — **attendre un `setTimeout(0)` avant `expectOne`** (le POST part après le chiffrement async).

```ts
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { HttpAccountTransactionGateway } from './http-account-transaction.gateway';

describe('HttpAccountTransactionGateway', () => {
  let gateway: HttpAccountTransactionGateway;
  let httpMock: HttpTestingController;
  let keySignal: CryptoKey | null;

  beforeEach(() => {
    keySignal = null;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        HttpAccountTransactionGateway,
        { provide: CryptoStore, useValue: { getMasterKey: () => keySignal } },
      ],
    });
    gateway = TestBed.inject(HttpAccountTransactionGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('coerce amount en number (plaintext)', () => {
    let received: number | undefined;
    gateway.getForAccount('acc-1').subscribe((txs) => { received = txs[0]?.amount; });
    const req = httpMock.expectOne('/bank-accounts/acc-1/transactions');
    req.flush([{ id: 't1', accountId: 'acc-1', amount: '12.50', direction: 'expense', toAccountId: null, date: '2026-06-01', category: 'food', note: null, memberId: null, recurringEntryId: null }]);
    expect(received).toBe(12.5);
  });

  it('chiffre puis déchiffre à la création (E2EE)', async () => {
    keySignal = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    let result: { amount: number } | undefined;
    gateway.create('acc-1', { amount: 30, direction: 'expense', toAccountId: null, date: '2026-06-02', category: 'food', note: 'courses', memberId: null, recurringEntryId: null })
      .subscribe((tx) => { result = tx; });

    await new Promise((r) => setTimeout(r, 0)); // le POST part après le chiffrement async

    const req = httpMock.expectOne('/bank-accounts/acc-1/transactions');
    expect(req.request.body.encryptedData).toBeTruthy();
    expect(req.request.body.amount).toBeUndefined(); // amount n'est pas en clair
    // le backend renvoie la ligne stockée (avec encryptedData) → la gateway la déchiffre
    req.flush({ ...req.request.body, id: 't9' });
    await new Promise((r) => setTimeout(r, 0));
    expect(result?.amount).toBe(30);
  });
});
```

- [ ] **Step 3 : Lancer le spec (échec attendu)**

Run: `cd dash-flow && ng test --include '**/http-account-transaction.gateway.spec.ts'`
Expected: FAIL — gateway introuvable.

- [ ] **Step 4 : Implémenter la gateway HTTP**

```ts
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { ApiRow } from '@core/services/crypto/entity-crypto';
import { decryptList, mutateEncrypted } from '@core/services/crypto/crypto-transport';
import { AccountTransaction } from '../domain/models/account-transaction.model';
import { AccountTransactionGateway } from '../domain/gateways/account-transaction.gateway';

const CLEARTEXT_KEYS = ['id', 'userId', 'accountId', 'toAccountId', 'direction', 'memberId', 'recurringEntryId', 'createdAt'] as const;

function coerceTransaction(row: ApiRow): AccountTransaction {
  const t = row as unknown as AccountTransaction;
  return { ...t, amount: Number(t.amount) };
}

@Injectable()
export class HttpAccountTransactionGateway implements AccountTransactionGateway {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  getForAccount(accountId: string): Observable<AccountTransaction[]> {
    return decryptList(this.api.get<ApiRow[]>(`/bank-accounts/${accountId}/transactions`), this.crypto.getMasterKey(), coerceTransaction);
  }

  getAll(): Observable<AccountTransaction[]> {
    return decryptList(this.api.get<ApiRow[]>('/transactions/all'), this.crypto.getMasterKey(), coerceTransaction);
  }

  create(accountId: string, data: Omit<AccountTransaction, 'id' | 'accountId'>): Observable<AccountTransaction> {
    return mutateEncrypted(data as Record<string, unknown>, CLEARTEXT_KEYS, this.crypto.getMasterKey(),
      (body) => this.api.post<ApiRow>(`/bank-accounts/${accountId}/transactions`, body));
  }

  update(id: string, data: Partial<Omit<AccountTransaction, 'id'>>): Observable<AccountTransaction> {
    return mutateEncrypted(data as Record<string, unknown>, CLEARTEXT_KEYS, this.crypto.getMasterKey(),
      (body) => this.api.put<ApiRow>(`/transactions/${id}`, body));
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/transactions/${id}`);
  }
}
```

- [ ] **Step 5 : Lancer le spec (vert attendu)**

Run: `cd dash-flow && ng test --include '**/http-account-transaction.gateway.spec.ts'`
Expected: PASS (plaintext + E2EE).

- [ ] **Step 6 : Commit (délégué, front)** — `feat(budget): gateway AccountTransaction (E2EE + plaintext)`

---

## Task 9 : Câblage du provider

**Files:**
- Modify: le fichier de providers budget (suivre le câblage existant de `LoanGateway` → grep pour le localiser).

- [ ] **Step 1 : Localiser le câblage existant**

Run: `cd dash-flow && grep -rn 'provide: LoanGateway' src/app`
Expected: trouve `{ provide: LoanGateway, useClass: HttpLoanGateway }` dans un `app.config.ts` ou un provider de route budget.

- [ ] **Step 2 : Ajouter le provider au même endroit**

```ts
{ provide: AccountTransactionGateway, useClass: HttpAccountTransactionGateway },
```

avec les imports correspondants (interface depuis `domain/gateways/...`, impl depuis `infra/...`).

- [ ] **Step 3 : Build**

Run: `cd dash-flow && pnpm build`
Expected: PASS.

- [ ] **Step 4 : Commit (délégué, front)** — `feat(budget): câble AccountTransactionGateway`

---

## Task 10 : Taxonomie de catégories (TDD)

**Files:**
- Modify: `dash-flow/src/app/features/budget/domain/categories.ts`
- Test: `dash-flow/src/app/features/budget/domain/categories.spec.ts`

> On **ajoute** une taxonomie (groupes + métadonnées par code) **sans casser** `BUDGET_CATEGORIES`/`normalizeCategory` déjà consommés par budget-analytics.

- [ ] **Step 1 : Écrire le spec rouge**

```ts
import { categoryMeta, CATEGORY_GROUPS, normalizeCategory } from './categories';

describe('categories taxonomy', () => {
  it('expose des groupes non vides', () => {
    expect(CATEGORY_GROUPS.length).toBeGreaterThan(0);
    expect(CATEGORY_GROUPS[0].categories.length).toBeGreaterThan(0);
  });

  it('categoryMeta résout un code connu', () => {
    const meta = categoryMeta('food');
    expect(meta.label).toBe('Alimentation');
    expect(meta.group).toBeTruthy();
  });

  it('categoryMeta retombe sur « Autre » pour un code inconnu', () => {
    expect(categoryMeta('inexistant').key).toBe('other');
  });

  it('normalizeCategory reste fonctionnel (rétro-compat)', () => {
    expect(normalizeCategory('ALIMENTATION').key).toBe('food');
  });
});
```

- [ ] **Step 2 : Lancer (échec attendu)**

Run: `cd dash-flow && ng test --include '**/categories.spec.ts'`
Expected: FAIL — `categoryMeta`/`CATEGORY_GROUPS` non exportés.

- [ ] **Step 3 : Étendre `categories.ts`**

Ajouter, en conservant l'existant :

```ts
export interface CategoryGroup {
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
```

- [ ] **Step 4 : Lancer (vert attendu)**

Run: `cd dash-flow && ng test --include '**/categories.spec.ts'`
Expected: PASS.

- [ ] **Step 5 : Commit (délégué, front)** — `feat(budget): taxonomie de catégories (groupes + categoryMeta)`

---

## Task 11 : Moteur `account-balance` (TDD)

**Files:**
- Create: `dash-flow/src/app/features/budget/domain/account-balance.ts`
- Test: `dash-flow/src/app/features/budget/domain/account-balance.spec.ts`

> Domain pur (zéro Angular). Utilise `addMoney` (centimes entiers) déjà présent dans `domain/money.ts`.

- [ ] **Step 1 : Écrire le spec rouge**

```ts
import { confirmedBalance, isRecurrencePosted } from './account-balance';
import { AccountTransaction } from './models/account-transaction.model';

const tx = (p: Partial<AccountTransaction>): AccountTransaction => ({
  id: 'x', accountId: 'a', amount: 0, direction: 'expense', toAccountId: null,
  date: '2026-06-01', category: null, note: null, memberId: null, recurringEntryId: null, ...p,
});

describe('confirmedBalance', () => {
  it('part du solde initial puis ajoute revenus et soustrait dépenses (≤ asOf)', () => {
    const txs = [
      tx({ direction: 'income', amount: 2000, date: '2026-06-01' }),
      tx({ direction: 'expense', amount: 500, date: '2026-06-02' }),
      tx({ direction: 'expense', amount: 999, date: '2026-06-30' }), // après asOf → ignoré
    ];
    expect(confirmedBalance({ initialBalance: 100 }, txs, '2026-06-15')).toBe(1600);
  });

  it('un transfert sortant débite le compte, un transfert entrant le crédite', () => {
    const out = tx({ direction: 'transfer', amount: 50, accountId: 'a', toAccountId: 'b' });
    const inc = tx({ direction: 'transfer', amount: 50, accountId: 'c', toAccountId: 'a' });
    expect(confirmedBalance({ initialBalance: 0, id: 'a' }, [out, inc], '2026-12-31')).toBe(0);
  });
});

describe('isRecurrencePosted', () => {
  it('vrai si une transaction porte le recurringEntryId pour ce mois', () => {
    const txs = [tx({ recurringEntryId: 'r1', date: '2026-06-05' })];
    expect(isRecurrencePosted('r1', '2026-06', txs)).toBe(true);
    expect(isRecurrencePosted('r1', '2026-07', txs)).toBe(false);
    expect(isRecurrencePosted('r2', '2026-06', txs)).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer (échec attendu)**

Run: `cd dash-flow && ng test --include '**/account-balance.spec.ts'`
Expected: FAIL — module introuvable.

- [ ] **Step 3 : Implémenter**

```ts
import { addMoney } from './money';
import { AccountTransaction } from './models/account-transaction.model';

/**
 * Solde confirmé d'un compte = solde initial + Σ revenus − Σ dépenses ± transferts,
 * sur les transactions dont la date est ≤ `asOf` (YYYY-MM-DD).
 * Le réel fait foi (cf. spec Tier 1) ; les récurrences ne projettent que le futur.
 */
export function confirmedBalance(
  account: { initialBalance: number; id?: string },
  txs: readonly AccountTransaction[],
  asOf: string,
): number {
  let balance = account.initialBalance;
  for (const t of txs) {
    if (t.date > asOf) continue;
    if (t.direction === 'income') balance = addMoney(balance, t.amount);
    else if (t.direction === 'expense') balance = addMoney(balance, -t.amount);
    else { // transfer
      if (account.id && t.toAccountId === account.id) balance = addMoney(balance, t.amount);
      else balance = addMoney(balance, -t.amount);
    }
  }
  return balance;
}

/** Une récurrence est « postée » pour le mois M (YYYY-MM) ssi une transaction porte son id ce mois-là. */
export function isRecurrencePosted(
  recurringEntryId: string,
  month: string,
  txs: readonly AccountTransaction[],
): boolean {
  return txs.some((t) => t.recurringEntryId === recurringEntryId && t.date.slice(0, 7) === month);
}
```

- [ ] **Step 4 : Lancer (vert attendu)**

Run: `cd dash-flow && ng test --include '**/account-balance.spec.ts'`
Expected: PASS.

- [ ] **Step 5 : Commit (délégué, front)** — `feat(budget): moteur account-balance (confirmedBalance + isRecurrencePosted)`

---

## Task 12 : Page « Relevé » (liste + solde confirmé, lecture)

**Files:**
- Create: `dash-flow/src/app/features/budget/pages/transactions/transactions.ts`
- Test: `dash-flow/src/app/features/budget/pages/transactions/transactions.spec.ts`
- Modify: la config de routes budget (grep pour la localiser).

> Composant smart : injecte `AccountTransactionGateway` + `BankAccountGateway`, affiche par compte la liste chronologique des transactions réelles + le **solde confirmé** via `confirmedBalance`. OnPush, zoneless, signals. (L'ajout/suppression est en Task 13.)

- [ ] **Step 1 : Écrire le spec rouge (calcul du solde confirmé affiché)**

```ts
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { Transactions } from './transactions';
import { AccountTransactionGateway } from '../../domain/gateways/account-transaction.gateway';
import { BankAccountGateway } from '../../domain/gateways/bank-account.gateway';

describe('Transactions page', () => {
  it('expose le solde confirmé du compte sélectionné', () => {
    const accounts = [{ id: 'a', name: 'Courant', type: 'courant', initialBalance: 100, color: null, dotColor: null }];
    const txs = [
      { id: 't1', accountId: 'a', amount: 2000, direction: 'income', toAccountId: null, date: '2000-01-01', category: null, note: null, memberId: null, recurringEntryId: null },
      { id: 't2', accountId: 'a', amount: 500, direction: 'expense', toAccountId: null, date: '2000-01-02', category: null, note: null, memberId: null, recurringEntryId: null },
    ];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        { provide: BankAccountGateway, useValue: { getAll: () => of(accounts) } },
        { provide: AccountTransactionGateway, useValue: { getForAccount: () => of(txs), getAll: () => of(txs) } },
      ],
    });
    const fixture = TestBed.createComponent(Transactions);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as { confirmedBalanceValue: () => number };
    expect(cmp.confirmedBalanceValue()).toBe(1600);
  });
});
```

- [ ] **Step 2 : Lancer (échec attendu)**

Run: `cd dash-flow && ng test --include '**/transactions.spec.ts'`
Expected: FAIL — composant introuvable.

- [ ] **Step 3 : Implémenter le composant**

```ts
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { AccountTransactionGateway } from '../../domain/gateways/account-transaction.gateway';
import { BankAccountGateway } from '../../domain/gateways/bank-account.gateway';
import { confirmedBalance } from '../../domain/account-balance';
import { categoryMeta } from '../../domain/categories';

@Component({
  selector: 'app-transactions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  host: { class: 'block p-6' },
  template: `
    <h1 class="text-xl font-semibold mb-4">Relevé</h1>

    <div class="flex flex-wrap gap-2 mb-4">
      @for (acc of accounts(); track acc.id) {
        <button type="button"
          class="px-3 py-1.5 rounded-lg text-sm"
          [class.bg-surface-raised]="selectedId() === acc.id"
          (click)="selectedId.set(acc.id)">{{ acc.name }}</button>
      }
    </div>

    <p class="text-2xl font-bold mb-6" data-testid="confirmed-balance">
      {{ confirmedBalanceValue() | number: '1.2-2' }} €
      <span class="text-sm font-normal text-text-muted">solde confirmé</span>
    </p>

    @if (transactions().length === 0) {
      <p class="text-text-muted">Aucun mouvement réel pour ce compte.</p>
    } @else {
      <ul class="divide-y divide-border">
        @for (t of transactions(); track t.id) {
          <li class="flex items-center justify-between py-2">
            <span>
              <span class="inline-block w-2 h-2 rounded-full mr-2" [style.background]="categoryColor(t.category)"></span>
              {{ t.date }} — {{ t.note || categoryLabel(t.category) }}
            </span>
            <span [class.text-ib-green]="t.direction === 'income'">
              {{ t.direction === 'income' ? '+' : '−' }}{{ t.amount | number: '1.2-2' }} €
            </span>
          </li>
        }
      </ul>
    }
  `,
})
export class Transactions {
  private readonly accountGateway = inject(BankAccountGateway);
  private readonly txGateway = inject(AccountTransactionGateway);

  protected readonly accounts = toSignal(this.accountGateway.getAll(), { initialValue: [] });
  protected readonly allTx = toSignal(this.txGateway.getAll(), { initialValue: [] });
  protected readonly selectedId = signal<string | null>(null);

  private readonly currentAccount = computed(() => {
    const id = this.selectedId() ?? this.accounts()[0]?.id ?? null;
    return this.accounts().find((a) => a.id === id) ?? null;
  });

  protected readonly transactions = computed(() => {
    const acc = this.currentAccount();
    if (!acc) return [];
    return this.allTx()
      .filter((t) => t.accountId === acc.id || t.toAccountId === acc.id)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  });

  protected readonly confirmedBalanceValue = computed(() => {
    const acc = this.currentAccount();
    if (!acc) return 0;
    const today = new Date().toISOString().slice(0, 10);
    return confirmedBalance(acc, this.transactions(), today);
  });

  protected categoryLabel(code: string | null): string { return categoryMeta(code).label; }
  protected categoryColor(code: string | null): string { return categoryMeta(code).color; }
}
```

> Le spec sélectionne le premier compte par défaut (`selectedId` null → `accounts()[0]`). Pour le test, `asOf = today` ; les dates de test sont en 2000 donc ≤ today.

- [ ] **Step 4 : Lancer (vert attendu)**

Run: `cd dash-flow && ng test --include '**/transactions.spec.ts'`
Expected: PASS.

- [ ] **Step 5 : Ajouter la route**

Localiser les routes budget : `cd dash-flow && grep -rn "bank-account" src/app/**/*.routes.ts src/app/**/*routing* 2>/dev/null` (ou grep `loadComponent` dans la feature budget). Ajouter une route lazy :

```ts
{ path: 'transactions', loadComponent: () => import('./pages/transactions/transactions').then((m) => m.Transactions) },
```

et un lien de navigation vers `/budget/transactions` à l'endroit où figurent les autres liens budget (sidebar / nav). Suivre le pattern de lien existant.

- [ ] **Step 6 : Build + suite complète front**

Run: `cd dash-flow && pnpm build && ng test`
Expected: PASS (les ~48 tests existants + les nouveaux).

- [ ] **Step 7 : Commit (délégué, front)** — `feat(budget): page Relevé (transactions réelles + solde confirmé)`

---

## Task 13 : Ajout + suppression d'un mouvement (TDD)

**Files:**
- Modify: `dash-flow/src/app/features/budget/pages/transactions/transactions.ts`
- Modify: `dash-flow/src/app/features/budget/pages/transactions/transactions.spec.ts`

> On enrichit la page Relevé d'un formulaire d'ajout inline (signals) et d'une suppression par ligne. Après chaque mutation, on recharge la liste depuis la gateway (source de vérité).

- [ ] **Step 1 : Écrire le test rouge (création appelle la gateway puis recharge)**

Ajouter au spec existant :

```ts
it('crée un mouvement via la gateway puis recharge', () => {
  const accounts = [{ id: 'a', name: 'Courant', type: 'courant', initialBalance: 0, color: null, dotColor: null }];
  const create = vi.fn(() => of({ id: 't9', accountId: 'a', amount: 12, direction: 'expense', toAccountId: null, date: '2026-06-10', category: 'food', note: null, memberId: null, recurringEntryId: null }));
  const getAll = vi.fn(() => of([]));
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      { provide: BankAccountGateway, useValue: { getAll: () => of(accounts) } },
      { provide: AccountTransactionGateway, useValue: { getAll, getForAccount: () => of([]), create, delete: () => of(void 0) } },
    ],
  });
  const fixture = TestBed.createComponent(Transactions);
  fixture.detectChanges();
  const cmp = fixture.componentInstance as unknown as {
    draftAmount: { set: (n: number) => void };
    draftDirection: { set: (d: string) => void };
    draftDate: { set: (d: string) => void };
    draftCategory: { set: (c: string) => void };
    addTransaction: () => void;
  };
  cmp.draftAmount.set(12); cmp.draftDirection.set('expense');
  cmp.draftDate.set('2026-06-10'); cmp.draftCategory.set('food');
  cmp.addTransaction();
  expect(create).toHaveBeenCalledWith('a', expect.objectContaining({ amount: 12, direction: 'expense', date: '2026-06-10', category: 'food' }));
  expect(getAll).toHaveBeenCalledTimes(2); // initial + reload après création
});
```

> `vi` est disponible globalement avec `@angular/build:unit-test` (Vitest). Importer `of` depuis `rxjs` si pas déjà fait.

- [ ] **Step 2 : Lancer (échec attendu)**

Run: `cd dash-flow && ng test --include '**/transactions.spec.ts'`
Expected: FAIL — `addTransaction`/`draftAmount` n'existent pas.

- [ ] **Step 3 : Enrichir le composant**

Ajouter les imports `FormsModule` et le rechargement. Remplacer `allTx` par un signal rechargeable et ajouter le brouillon + les handlers :

```ts
// imports composant : ajouter FormsModule
// providers RxJS : import { of } depuis 'rxjs' n'est pas requis ici

// État du brouillon
protected readonly draftAmount = signal<number>(0);
protected readonly draftDirection = signal<'income' | 'expense' | 'transfer'>('expense');
protected readonly draftDate = signal<string>(new Date().toISOString().slice(0, 10));
protected readonly draftCategory = signal<string>('other');

// Liste rechargeable : remplacer `allTx = toSignal(...)` par un trigger + reload
private readonly _reload = signal(0);
private readonly _allTx = signal<AccountTransaction[]>([]);
protected readonly allTx = this._allTx.asReadonly();

private reload(): void {
  this.txGateway.getAll().pipe(takeUntilDestroyed(this._destroyRef)).subscribe((txs) => this._allTx.set(txs));
}

addTransaction(): void {
  const acc = this.currentAccount();
  if (!acc) return;
  this.txGateway.create(acc.id, {
    amount: this.draftAmount(), direction: this.draftDirection(), toAccountId: null,
    date: this.draftDate(), category: this.draftCategory(), note: null,
    memberId: null, recurringEntryId: null,
  }).pipe(takeUntilDestroyed(this._destroyRef)).subscribe(() => { this.draftAmount.set(0); this.reload(); });
}

removeTransaction(id: string): void {
  this.txGateway.delete(id).pipe(takeUntilDestroyed(this._destroyRef)).subscribe(() => this.reload());
}
```

Détails de câblage :
- Injecter `private readonly _destroyRef = inject(DestroyRef);` (import `DestroyRef` depuis `@angular/core`, `takeUntilDestroyed` depuis `@angular/core/rxjs-interop`).
- Appeler `this.reload();` dans le constructeur (ou via un `afterNextRender`/init) pour le chargement initial — remplace le `toSignal` initial.
- Template : ajouter un mini-formulaire (montant `[(ngModel)]="..."` via signals → utiliser `(ngModelChange)="draftAmount.set($event)"`, `[ngModel]="draftAmount()"`), un `<select>` direction, un `<select>` catégorie alimenté par `CATEGORY_GROUPS` (`<optgroup>`), bouton « Ajouter » `(click)="addTransaction()"`, et un bouton « Supprimer » par ligne `(click)="removeTransaction(t.id)"`.

> Le test précédent (`confirmedBalanceValue`) reste vert : il fournit désormais `getAll` retournant les txs, le `reload()` initial peuplera `_allTx`.

- [ ] **Step 4 : Adapter le 1er test au modèle rechargeable**

Le test « expose le solde confirmé » fournit déjà `getAll: () => of(txs)` ; vérifier qu'après `fixture.detectChanges()` le `reload()` initial a peuplé la liste. Si le chargement initial est dans le constructeur, c'est synchrone avec `of(...)`. PASS attendu.

- [ ] **Step 5 : Lancer (vert attendu)**

Run: `cd dash-flow && ng test --include '**/transactions.spec.ts'`
Expected: PASS (les deux tests).

- [ ] **Step 6 : Build + suite complète + smoke navigateur**

Run: `cd dash-flow && pnpm build && ng test`
Expected: PASS.

Puis smoke via le compte démo (cf. `reference_dashflow_demo_verif`) : `/budget/transactions` → ajouter un mouvement → le solde confirmé bouge → supprimer. Zéro erreur console (pas de NG02100 DecimalPipe → coercition `Number()` OK).

- [ ] **Step 7 : Commit (délégué, front)** — `feat(budget): ajout et suppression de mouvements sur le Relevé`

---

## Vérification de fin de plan

- [ ] Back : `cd nest-dashflow-app && pnpm build && pnpm test` → PASS.
- [ ] Front : `cd dash-flow && pnpm build && ng test` → PASS.
- [ ] Migration `0004` appliquée sur dev, table présente.
- [ ] Smoke navigateur OK.
- [ ] Tous les commits proposés à l'utilisateur (back + front séparés), aucun push.

## Notes pour les plans suivants

- **Plan 2 (dashboard)** : intégrer `confirmedBalance` dans `bank-account.ts` (834 l.) ; les computeds `currentBalance`/`endOfMonthBalance` (basés récurrences) deviennent confirmé (transactions réelles) + projeté (récurrences non postées via `isRecurrencePosted`). Ajouter `projectedBalance` + `monthReconciliation` au moteur. Convertir `bank-transfers-panel` ponctuels en transactions `transfer`.
- **Plan 3 (auto-postage)** : `PendingChargesPanel` consommant `isRecurrencePosted` ; CRUD `update` de transaction côté UI (édition).
- **Plan 4 (import)** : endpoint `POST /bank-accounts/:id/transactions/batch` + parser front OFX/CSV + dédup + catégorisation auto.
