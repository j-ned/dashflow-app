# Modules data Finance (B5a) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Porter les 6 modules CRUD finance de Hono en NestJS sur une base CRUD partagée, scopés par userId, double mode encryptedData/plaintext.

**Architecture:** `OwnedCrudService<TRow>` générique (ownership + CRUD) dans `common/crud` ; chaque module (`src/modules/<feature>`) compose la base + sa logique. Routes sous `/api/<feature>`, `JwtAuthGuard` (+`CsrfGuard` sur mutations).

**Tech Stack:** NestJS, Drizzle (postgres-js), Zod, Vitest + supertest.

> ⚠️ J-Ned : commits locaux, **jamais de push**. Cwd : `/home/jned/WebstormProjects/DashFlow/nest-dashflow-app/`. DB up pour e2e.
> **Sources de port** (lire pour les champs/validation exacts) : `dash-flow/backend/src/routes/{bank-account,envelope,loan,recurring-entry,salary-archive}.routes.ts` + `dash-flow/backend/src/validation.ts`. Schéma Drizzle : `src/db/schema/finance.ts`.
> Réutilise : `DRIZZLE`/`DrizzleDB` (`src/db/drizzle.constants`), `ZodValidationPipe`, `JwtAuthGuard`, `CsrfGuard`, `@CurrentUser()`/`AuthUser`.

---

## File Structure

| Fichier | Rôle |
|---|---|
| `src/common/crud/owned-crud.service.ts` | base CRUD générique scopée userId |
| `src/modules/bank-accounts/*` | module bank-accounts (template) |
| `src/modules/consumables/*` | CRUD plaintext |
| `src/modules/envelopes/*` | CRUD + transactions + balance |
| `src/modules/loans/*` | CRUD + transactions + remaining |
| `src/modules/recurring-entries/*` | CRUD double mode |
| `src/modules/salary-archives/*` | CRUD + snapshot |
| `src/app.module.ts` | importe les 6 modules |
| `test/finance.e2e-spec.ts` | e2e bank-accounts + envelopes |

Chaque module = `<f>.module.ts` + `<f>.controller.ts` + `<f>.service.ts` + `dto/<f>.dto.ts`.

---

## Task 1: OwnedCrudService (base, TDD)

**Files:** Create `src/common/crud/owned-crud.service.ts`, `src/common/crud/owned-crud.service.spec.ts`

- [ ] **Step 1: Test** (utilise une vraie table simple via la DB locale — `bankAccounts` — ou un mock du client). Mock-based pour rester unitaire :
```ts
import { describe, it, expect, vi } from 'vitest';
import { OwnedCrudService } from './owned-crud.service';

function fakeDb(rows: any[]) {
  const chain: any = {
    _rows: rows,
    select: vi.fn(() => chain), from: vi.fn(() => chain), where: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(chain._rows)),
    insert: vi.fn(() => chain), values: vi.fn(() => chain),
    returning: vi.fn(() => Promise.resolve(chain._rows)),
    update: vi.fn(() => chain), set: vi.fn(() => chain),
    delete: vi.fn(() => chain),
  };
  return chain;
}
const table = { id: 'idcol', userId: 'usercol' } as any;

describe('OwnedCrudService', () => {
  it('getOne renvoie undefined si non possédé', async () => {
    const svc = new OwnedCrudService(fakeDb([]) as any, table);
    expect(await svc.getOne('u1', 'x')).toBeUndefined();
  });
  it('create injecte userId', async () => {
    const db = fakeDb([{ id: 'r1' }]);
    const svc = new OwnedCrudService(db as any, table);
    const row = await svc.create('u1', { name: 'A' });
    expect(db.values).toHaveBeenCalledWith({ name: 'A', userId: 'u1' });
    expect(row).toEqual({ id: 'r1' });
  });
});
```

- [ ] **Step 2:** Run → FAIL.

- [ ] **Step 3:** `src/common/crud/owned-crud.service.ts` :
```ts
import { and, eq } from 'drizzle-orm';
import type { DrizzleDB } from '../../db/drizzle.constants';

/** Table Drizzle possédant les colonnes `id` et `userId`. */
export class OwnedCrudService<TRow> {
  constructor(
    protected readonly db: DrizzleDB,
    protected readonly table: any,
  ) {}

  list(userId: string): Promise<TRow[]> {
    return this.db.select().from(this.table).where(eq(this.table.userId, userId)).limit(100) as Promise<TRow[]>;
  }

  async getOne(userId: string, id: string): Promise<TRow | undefined> {
    const rows = await this.db.select().from(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.userId, userId))).limit(1);
    return rows[0] as TRow | undefined;
  }

  async create(userId: string, values: Record<string, unknown>): Promise<TRow> {
    const rows = await this.db.insert(this.table).values({ ...values, userId }).returning();
    return rows[0] as TRow;
  }

  async update(userId: string, id: string, patch: Record<string, unknown>): Promise<TRow | undefined> {
    const rows = await this.db.update(this.table).set(patch)
      .where(and(eq(this.table.id, id), eq(this.table.userId, userId))).returning();
    return rows[0] as TRow | undefined;
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.db.delete(this.table).where(and(eq(this.table.id, id), eq(this.table.userId, userId)));
  }
}
```

- [ ] **Step 4:** Run → PASS. **Step 5: Commit** — `feat(b5a): OwnedCrudService base`

---

## Task 2: bank-accounts (template complet)

**Files:** Create `src/modules/bank-accounts/{bank-accounts.module,bank-accounts.controller,bank-accounts.service}.ts`, `dto/bank-account.dto.ts`; Modify `src/app.module.ts`

- [ ] **Step 1: DTOs** `src/modules/bank-accounts/dto/bank-account.dto.ts` (port `validation.ts`) :
```ts
import { z } from 'zod';
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const createBankAccountSchema = z.object({
  name: z.string().min(1).max(255),
  initialBalance: z.coerce.number().optional(),
  color: hexColor.optional(),
  dotColor: hexColor.optional(),
});
export const createEncryptedBankAccountSchema = z.object({ encryptedData: z.string().min(1) });
export type CreateBankAccountDto = z.infer<typeof createBankAccountSchema>;
```

- [ ] **Step 2: Service** `bank-accounts.service.ts` :
```ts
import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { bankAccounts } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';

type BankAccount = typeof bankAccounts.$inferSelect;

@Injectable()
export class BankAccountsService extends OwnedCrudService<BankAccount> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) { super(db, bankAccounts); }
}
```

- [ ] **Step 3: Controller** `bank-accounts.controller.ts` (double mode explicite) :
```ts
import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Put, UseGuards } from '@nestjs/common';
import { BankAccountsService } from './bank-accounts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { createBankAccountSchema, createEncryptedBankAccountSchema } from './dto/bank-account.dto';

@UseGuards(JwtAuthGuard)
@Controller('bank-accounts')
export class BankAccountsController {
  constructor(private readonly svc: BankAccountsService) {}

  @Get()
  list(@CurrentUser() u: AuthUser) { return this.svc.list(u.id); }

  @UseGuards(CsrfGuard) @Post() @HttpCode(201)
  async create(@CurrentUser() u: AuthUser, @Body() body: Record<string, unknown>) {
    if (body.encryptedData) {
      const { encryptedData } = createEncryptedBankAccountSchema.parse(body);
      return this.svc.create(u.id, { name: '', encryptedData });
    }
    const d = createBankAccountSchema.parse(body);
    return this.svc.create(u.id, {
      name: d.name, initialBalance: String(d.initialBalance ?? 0),
      color: d.color ?? null, dotColor: d.dotColor ?? null,
    });
  }

  @UseGuards(CsrfGuard) @Put(':id')
  async update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const patch = body.encryptedData
      ? { encryptedData: body.encryptedData }
      : (({ id: _i, userId: _u, createdAt: _c, ...rest }) => rest)(body);
    const row = await this.svc.update(u.id, id, patch);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }

  @UseGuards(CsrfGuard) @Delete(':id') @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { await this.svc.remove(u.id, id); }
}
```
> `createBankAccountSchema.parse` lève une ZodError → mappée en 400 par un exception-mapper. Si le `HttpExceptionFilter` global ne gère pas ZodError, l'envelopper : `try { ... } catch (e) { throw new BadRequestException(...) }`. **Décision** : ajouter un petit util `parseBody(schema, body)` dans `common/` qui parse et lève `BadRequestException(first issue)`. Le créer en Step 3bis ci-dessous et l'utiliser partout.

- [ ] **Step 3bis: util `parseBody`** `src/common/parse-body.ts` :
```ts
import { BadRequestException } from '@nestjs/common';
import type { ZodType } from 'zod';
export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) throw new BadRequestException(r.error.issues[0]?.message ?? 'Données invalides');
  return r.data;
}
```
Remplacer les `.parse(body)` du controller par `parseBody(schema, body)`.

- [ ] **Step 4: Module** `bank-accounts.module.ts` :
```ts
import { Module } from '@nestjs/common';
import { BankAccountsController } from './bank-accounts.controller';
import { BankAccountsService } from './bank-accounts.service';

@Module({ controllers: [BankAccountsController], providers: [BankAccountsService] })
export class BankAccountsModule {}
```
Ajouter `BankAccountsModule` aux imports de `src/app.module.ts`.

- [ ] **Step 5:** `pnpm tsc --noEmit` clean + `pnpm test`. Boot smoke (DB up) : routes `/api/bank-accounts` mappées ; **tuer le serveur + libérer :3001** après (`pkill -9 -f "cli/bin/nest.js start"; for P in $(ss -ltnp 2>/dev/null|grep ':3001 '|grep -oE 'pid=[0-9]+'|cut -d= -f2|sort -u); do kill -9 $P; done`).

- [ ] **Step 6: Commit** — `feat(b5a): module bank-accounts (template CRUD) + parseBody util`

---

## Task 3: consumables (CRUD plaintext)

**Files:** Create `src/modules/consumables/*`; Modify `src/app.module.ts`

Port fidèle de... ⚠️ **il n'existe pas de `consumable.routes.ts` dans Hono** (consumables n'est pas exposé en route Hono — vérifier `dash-flow/backend/src/routes/`). **Si absent**, créer un CRUD plaintext standard sur la table `consumables` (champs : `name, category, quantity, minThreshold, unitPrice, lastRestocked?, installedAt?, estimatedLifetimeDays?`), même pattern que bank-accounts SANS double mode (pas d'`encryptedData`). DTO Zod depuis les colonnes de `src/db/schema/finance.ts`.

- [ ] **Step 1:** Vérifier l'existence d'une route Hono consumables : `ls dash-flow/backend/src/routes/ | grep -i consum`. Si présente, **port fidèle** ; sinon CRUD plaintext standard (ci-dessus).
- [ ] **Step 2:** DTO `dto/consumable.dto.ts` (Zod sur les colonnes), Service `extends OwnedCrudService<Consumable>` (table `consumables`), Controller CRUD plaintext (GET/POST/PUT/DELETE, guards Jwt+Csrf, `parseBody`), Module ; ajouter à `app.module.ts`.
- [ ] **Step 3:** `pnpm tsc --noEmit` + `pnpm test` verts.
- [ ] **Step 4: Commit** — `feat(b5a): module consumables (CRUD plaintext)`

---

## Task 4: envelopes (CRUD + transactions + balance)

**Files:** Create `src/modules/envelopes/*`; Modify `src/app.module.ts`. **Source : `envelope.routes.ts`.**

- [ ] **Step 1: DTOs** `dto/envelope.dto.ts` — port depuis `validation.ts` : `createEnvelopeSchema` (name, type enum, balance?, target?, color?, dueDay?, memberId?), `createEncryptedEnvelopeSchema` ({encryptedData, memberId?}), `envelopeTransactionSchema` ({amount, date}), `creditEnvelopeSchema` ({amount, date?}), `creditEncryptedEnvelopeSchema` ({encryptedData}).

- [ ] **Step 2: Service** `envelopes.service.ts` — `extends OwnedCrudService<Envelope>` (table `envelopes`) + méthodes spécifiques :
```ts
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, getTableColumns } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { envelopes, envelopeTransactions } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';

type Envelope = typeof envelopes.$inferSelect;
const today = (): string => new Date().toISOString().slice(0, 10);

@Injectable()
export class EnvelopesService extends OwnedCrudService<Envelope> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) { super(db, envelopes); }

  allTransactions(userId: string) {
    return this.db.select(getTableColumns(envelopeTransactions)).from(envelopeTransactions)
      .innerJoin(envelopes, and(eq(envelopeTransactions.envelopeId, envelopes.id), eq(envelopes.userId, userId)))
      .limit(1000);
  }

  async transactionsOf(userId: string, id: string) {
    const env = await this.getOne(userId, id);
    if (!env) return undefined;
    return this.db.select().from(envelopeTransactions)
      .where(eq(envelopeTransactions.envelopeId, id))
      .orderBy(desc(envelopeTransactions.date), desc(envelopeTransactions.createdAt)).limit(100);
  }

  async addTransaction(userId: string, id: string, values: { amount: string; date: string; encryptedData?: string }) {
    const env = await this.getOne(userId, id);
    if (!env) return undefined;
    const [row] = await this.db.insert(envelopeTransactions).values({ envelopeId: id, ...values }).returning();
    return row;
  }

  async credit(userId: string, id: string, opts: { encryptedData?: string; amount?: number; date?: string }) {
    const env = await this.getOne(userId, id);
    if (!env) return undefined;
    return this.db.transaction(async (tx) => {
      if (opts.encryptedData) {
        const [u] = await tx.update(envelopes).set({ encryptedData: opts.encryptedData })
          .where(and(eq(envelopes.id, id), eq(envelopes.userId, userId))).returning();
        await tx.insert(envelopeTransactions).values({ envelopeId: id, amount: '0', date: today(), encryptedData: opts.encryptedData });
        return u;
      }
      const newBalance = String(Number((env as Envelope).balance) + (opts.amount ?? 0));
      const [u] = await tx.update(envelopes).set({ balance: newBalance })
        .where(and(eq(envelopes.id, id), eq(envelopes.userId, userId))).returning();
      await tx.insert(envelopeTransactions).values({ envelopeId: id, amount: String(opts.amount ?? 0), date: opts.date || today() });
      return u;
    });
  }
}
```

- [ ] **Step 3: Controller** `envelopes.controller.ts` — routes (parité Hono) : `GET /`, `GET /:id` (404), `POST /` (double mode → values), `PUT /:id` (double mode), `GET /transactions/all`, `GET /:id/transactions` (404), `POST /:id/transactions` (double mode : encrypted → {amount:'0', date: today, encryptedData} ; plaintext → parse `envelopeTransactionSchema`), `PATCH /:id/balance` (double mode → `credit`), `DELETE /:id`. Guards Jwt ; Csrf sur POST/PUT/PATCH/DELETE. `parseBody` pour la validation. 404 → `NotFoundException`. **⚠️ ordre des routes** : déclarer `GET /transactions/all` AVANT `GET /:id` (sinon `:id` capture `transactions`). En NestJS l'ordre des méthodes dans la classe = ordre d'enregistrement → placer `transactionsAll` avant `getOne`.

- [ ] **Step 4: Module** + ajout `app.module.ts`. `pnpm tsc --noEmit` + `pnpm test`.

- [ ] **Step 5: Commit** — `feat(b5a): module envelopes (CRUD + transactions + balance)`

---

## Task 5: loans (CRUD + transactions + remaining)

**Files:** Create `src/modules/loans/*`; Modify `src/app.module.ts`. **Source : `loan.routes.ts` (à lire intégralement).**

- [ ] **Step 1:** Lire `dash-flow/backend/src/routes/loan.routes.ts` + schémas loan de `validation.ts`. Porter à l'identique sur le même pattern que `envelopes` : CRUD double mode, sous-ressource transactions (`GET/POST /:id/transactions`, `GET /transactions/all`), et l'opération de remboursement qui recalcule `remaining` dans une `db.transaction` (équivalent du `PATCH balance`). Service `extends OwnedCrudService<Loan>` (table `loans`).
- [ ] **Step 2:** Controller (parité routes Hono, mêmes codes, double mode, ownership), Module, ajout `app.module.ts`.
- [ ] **Step 3:** `pnpm tsc --noEmit` + `pnpm test` verts.
- [ ] **Step 4: Commit** — `feat(b5a): module loans (CRUD + transactions + remaining)`

---

## Task 6: recurring-entries (CRUD double mode)

**Files:** Create `src/modules/recurring-entries/*`; Modify `src/app.module.ts`. **Source : `recurring-entry.routes.ts`.**

- [ ] **Step 1:** Lire `recurring-entry.routes.ts` + schémas. Porter le CRUD double mode (champs : `label, amount, type enum, dayOfMonth?, date?, endDate?, accountId?, toAccountId?, category?, payslipKey?, memberId?`). Même pattern que bank-accounts (CRUD) ; conserver toute route spécifique éventuelle à l'identique.
- [ ] **Step 2:** DTO/Service/Controller/Module, ajout `app.module.ts`.
- [ ] **Step 3:** tsc + test verts. **Step 4: Commit** — `feat(b5a): module recurring-entries`

---

## Task 7: salary-archives (CRUD + snapshot)

**Files:** Create `src/modules/salary-archives/*`; Modify `src/app.module.ts`. **Source : `salary-archive.routes.ts`.**

- [ ] **Step 1:** Lire `salary-archive.routes.ts` + schémas. Porter le CRUD + la logique de snapshot `spendings` (jsonb) à l'identique (champs : `accountId?, month, salary, totalExpenses, totalSpendings, spendings[], payslipKey?`). Service `extends OwnedCrudService<SalaryArchive>`.
- [ ] **Step 2:** DTO/Service/Controller/Module, ajout `app.module.ts`.
- [ ] **Step 3:** tsc + test verts. **Step 4: Commit** — `feat(b5a): module salary-archives`

---

## Task 8: e2e finance (bank-accounts + envelopes)

**Files:** Create `test/finance.e2e-spec.ts`

- [ ] **Step 1:** e2e supertest réutilisant le helper de login (register→verify→cookie + csrf, cf. `test/auth.e2e-spec.ts`). Scénarios :
  - bank-accounts : `POST` (plaintext) → 201 ; `GET /` contient la ligne ; `PUT /:id` modifie ; un **2e user** ne voit pas la ligne (GET vide) et `PUT`/`DELETE` sur l'id de l'autre → 404 ; `DELETE` → 204.
  - envelopes : `POST` → 201 ; `POST /:id/transactions` (plaintext amount/date) → 201 ; `PATCH /:id/balance` {amount:10} → balance augmentée + transaction créée ; `GET /:id/transactions` la liste.
  Récupérer cookie+csrf via : `GET /api/auth/csrf` puis header `X-CSRF-Token` sur les mutations.
```ts
// squelette
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { MAILER, type Mailer } from '../src/mail/mailer';

class CapturingMailer implements Mailer { lastCode=''; async sendVerificationCode(_:string,c:string){this.lastCode=c;} async sendPasswordResetCode(_:string,c:string){this.lastCode=c;} }

async function authedClient(app: INestApplication, mailer: CapturingMailer) {
  const s = app.getHttpServer(); const email = `fin+${Date.now()}-${Math.floor(Math.random()*1e6)}@dashflow.test`;
  await request(s).post('/api/auth/register').send({ email, password: 'motdepasse-long-12' }).expect(201);
  const v = await request(s).post('/api/auth/verify').send({ email, code: mailer.lastCode }).expect(200);
  const sessionCookie = v.headers['set-cookie'] as unknown as string[];
  const csrf = await request(s).get('/api/auth/csrf').set('Cookie', sessionCookie).expect(200);
  const cookies = sessionCookie.concat(csrf.headers['set-cookie'] as unknown as string[]);
  return { s, cookies, csrf: csrf.body.csrfToken as string };
}

describe('Finance e2e', () => {
  let app: INestApplication; const mailer = new CapturingMailer();
  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(MAILER).useValue(mailer).compile();
    app = m.createNestApplication(); app.use(cookieParser()); app.setGlobalPrefix('api'); await app.init();
  });
  afterAll(async () => { await app.close(); });

  it('bank-accounts : CRUD + ownership', async () => {
    const a = await authedClient(app, mailer);
    const created = await request(a.s).post('/api/bank-accounts').set('Cookie', a.cookies).set('X-CSRF-Token', a.csrf).send({ name: 'Courant', initialBalance: 100 }).expect(201);
    const id = created.body.id;
    await request(a.s).get('/api/bank-accounts').set('Cookie', a.cookies).expect(200).then(r => expect(r.body.some((x:any)=>x.id===id)).toBe(true));
    const b = await authedClient(app, mailer);
    await request(a.s).put(`/api/bank-accounts/${id}`).set('Cookie', b.cookies).set('X-CSRF-Token', b.csrf).send({ name: 'Hack' }).expect(404);
    await request(a.s).delete(`/api/bank-accounts/${id}`).set('Cookie', a.cookies).set('X-CSRF-Token', a.csrf).expect(204);
  });

  it('envelopes : transaction + balance', async () => {
    const a = await authedClient(app, mailer);
    const env = await request(a.s).post('/api/envelopes').set('Cookie', a.cookies).set('X-CSRF-Token', a.csrf).send({ name: 'Vacances', type: 'vacances' }).expect(201);
    const id = env.body.id;
    await request(a.s).patch(`/api/envelopes/${id}/balance`).set('Cookie', a.cookies).set('X-CSRF-Token', a.csrf).send({ amount: 10 }).expect(200);
    const tx = await request(a.s).get(`/api/envelopes/${id}/transactions`).set('Cookie', a.cookies).expect(200);
    expect(tx.body.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2:** `pnpm test:e2e` → tous verts (auth + oauth + finance). **Step 3: Commit** — `test(b5a): e2e finance (bank-accounts + envelopes)`

---

## Self-Review

**Couverture du spec :**
- OwnedCrudService base → Task 1 ✓
- 6 modules finance (bank-accounts, consumables, envelopes, loans, recurring-entries, salary-archives) → Tasks 2-7 ✓
- Double mode encryptedData/plaintext → Tasks 2,4 (template) + 5,6,7 (port) ✓
- Transactions SQL (balance/remaining/snapshot) → Tasks 4,5,7 ✓
- Guards Jwt(+Csrf mutations) → tous les controllers ✓
- e2e + ownership cross-user → Task 8 ✓
- parseBody util (ZodError→400) → Task 2 (3bis) ✓

**Placeholders :** base + bank-accounts + envelopes entièrement inlinés (templates). consumables/loans/recurring/salary décrits par **contrat + champs + source Hono à porter** — justifié (6 modules, pattern identique prouvé par 2 templates concrets + sources lisibles). Pas de TODO.

**Cohérence des types :** `OwnedCrudService<TRow>(db, table)` (Task 1) étendu par tous les services. `parseBody` (Task 2) réutilisé partout. `@CurrentUser()`/`AuthUser`, guards, `DRIZZLE`/`DrizzleDB` cohérents (B0/B1). Ordre routes envelopes (`/transactions/all` avant `/:id`) noté.
