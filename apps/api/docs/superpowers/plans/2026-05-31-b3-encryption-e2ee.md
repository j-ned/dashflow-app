# Chiffrement E2EE (B3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Porter les endpoints de chiffrement E2EE (encryption-keys, passphrase, migrate, wipe, reset-with-recovery) en NestJS, wire-compatibles, et réconcilier la règle re-wrap de `/reset-password`.

**Architecture:** `EncryptionService` (injecte `AuthRepository` + `DRIZZLE`) porte la logique ; `EncryptionController` (module auth, routes `/auth/*`) expose les endpoints ; migrate/wipe écrivent directement sur les 13 tables data via le schéma Drizzle porté en B0.

**Tech Stack:** NestJS, Drizzle (postgres-js), Zod, argon2, Vitest.

> ⚠️ J-Ned : commits locaux, **jamais de push**. Cwd : `/home/jned/WebstormProjects/DashFlow/nest-dashflow-app/`. DB up pour l'intégration.
> Contexte (B1/B2) : `AuthRepository` (`findByEmail`, `findById`, `updateUser`, `findValidCode`, `deleteCodes`), `AuthService` (`resetPassword` avec `checkRewrap` à retirer ; `changePassword`/`setPassword` gardent `checkRewrap`), `auth.result.ts` (`ok`/`fail`/`Result`), `auth.controller.ts` (`httpFrom`, guards, `STRICT`), `dto/auth.dto.ts` (`email`, `resetPasswordSchema`), `auth.module.ts`, `DRIZZLE` token + `DrizzleDB` type, schéma `src/db/schema`.

---

## File Structure

| Fichier | Action |
|---|---|
| `src/auth/dto/auth.dto.ts` | + 4 schémas E2EE ; `resetPasswordSchema` − rewrap |
| `src/auth/auth.service.ts` | `resetPassword` − `checkRewrap` (réconciliation) |
| `src/auth/auth.service.spec.ts` | maj test reset (v=1 sans clés → succès) |
| `src/auth/encryption.service.ts` | nouveau : setKeys/setPassphrase/migrate/wipe/resetWithRecovery |
| `src/auth/encryption.service.spec.ts` | unit (ops user) |
| `src/auth/encryption.controller.ts` | nouveau : 5 endpoints |
| `src/auth/auth.module.ts` | + EncryptionService + EncryptionController |
| `test/encryption.integration-spec.ts` | migrate + wipe sur vraie DB |

---

## Task 1: DTOs E2EE + réconciliation resetPasswordSchema

**Files:** Modify `src/auth/dto/auth.dto.ts`

- [ ] **Step 1:** Ajouter dans `src/auth/dto/auth.dto.ts` :
```ts
export const setupEncryptionKeysSchema = z.object({
  salt: z.string().min(1),
  wrappedMasterKey: z.string().min(1),
  recoveryWrappedKey: z.string().min(1),
});
export const encryptionPassphraseSchema = z.object({ passphrase: z.string().min(8, 'La passphrase doit faire au moins 8 caractères') });
export const migrateEncryptionSchema = z.object({
  keyMaterial: setupEncryptionKeysSchema,
  data: z.record(z.string(), z.array(z.object({ id: z.string().uuid(), encryptedData: z.string() }))),
});
export const resetWithRecoverySchema = z.object({
  email, code: z.string().length(6), newPassword: password,
  newSalt: z.string().optional(), newWrappedMasterKey: z.string().optional(),
});
export type SetupEncryptionKeysDto = z.infer<typeof setupEncryptionKeysSchema>;
export type MigrateEncryptionDto = z.infer<typeof migrateEncryptionSchema>;
export type ResetWithRecoveryDto = z.infer<typeof resetWithRecoverySchema>;
```
(`email`, `password`, `code` helpers existent déjà en haut du fichier — réutiliser. Si `code`/`password` ne sont pas des consts exportées mais inline, recréer `z.string().length(6)` / `z.string().min(12,...)` localement.)

- [ ] **Step 2:** Modifier `resetPasswordSchema` pour **retirer** `...rewrap` :
```ts
export const resetPasswordSchema = z.object({ email, code, newPassword: password });
```
(Conserver `updatePasswordSchema` et `setPasswordSchema` AVEC `...rewrap` — inchangés.)

- [ ] **Step 3:** `pnpm tsc --noEmit` → clean. **Step 4: Commit** — `feat(b3): DTOs E2EE + retrait rewrap de resetPasswordSchema`

---

## Task 2: Réconciliation AuthService.resetPassword

**Files:** Modify `src/auth/auth.service.ts`, `src/auth/auth.service.spec.ts`

- [ ] **Step 1:** Mettre à jour le test dans `src/auth/auth.service.spec.ts` — remplacer/ajouter :
```ts
  it('resetPassword : compte chiffré (v=1) SANS clés → succès (pas de 400)', async () => {
    r.findValidCode.mockResolvedValue({ id: 'c1' });
    r.findByEmail.mockResolvedValue({ id: 'u1', email: 'a@b.com', encryptionVersion: 1 });
    r.updateUser.mockResolvedValue({ id: 'u1' });
    const res = await svc.resetPassword({ email: 'a@b.com', code: '123456', newPassword: 'nouveau-long-123' });
    expect(res.success).toBe(true);
  });
```
(Si un ancien test attendait un 400 sur resetPassword v=1, le supprimer.)

- [ ] **Step 2:** Run → FAIL (resetPassword renvoie encore 400).

- [ ] **Step 3:** Dans `src/auth/auth.service.ts`, simplifier `resetPassword` (retirer `checkRewrap`) :
```ts
  async resetPassword(dto: ResetPasswordDto): Promise<Result<null>> {
    const valid = await this.repo.findValidCode(dto.email, dto.code);
    if (!valid) return fail(400, 'Code invalide ou expiré');
    const user = await this.repo.findByEmail(dto.email);
    if (!user) return fail(404, 'Compte introuvable');
    await this.repo.updateUser(user.id, { password: await argon2.hash(dto.newPassword) });
    await this.repo.deleteCodes(dto.email);
    return ok(null);
  }
```
(`ResetPasswordDto` n'a plus `newSalt`/`newWrappedMasterKey` après Task 1 — OK. `changePassword`/`setPassword` gardent `checkRewrap` : ne pas y toucher.)

- [ ] **Step 4:** Run `pnpm test` → tous verts (réconciliation + anciens). **Step 5: Commit** — `fix(b3): resetPassword sans enforcement re-wrap (parité Hono)`

---

## Task 3: EncryptionService — ops user (TDD)

**Files:** Create `src/auth/encryption.service.ts`, `src/auth/encryption.service.spec.ts`

- [ ] **Step 1: Test** `src/auth/encryption.service.spec.ts` :
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import argon2 from 'argon2';
import { EncryptionService } from './encryption.service';

const repo = () => ({ findByEmail: vi.fn(), findById: vi.fn(), updateUser: vi.fn(), findValidCode: vi.fn(), deleteCodes: vi.fn() });

describe('EncryptionService (ops user)', () => {
  let r: ReturnType<typeof repo>; let svc: EncryptionService;
  beforeEach(() => { r = repo(); svc = new EncryptionService(r as any, {} as any); });

  it('setKeys : update les 3 clés + version=1', async () => {
    r.updateUser.mockResolvedValue({ id: 'u1' });
    const res = await svc.setKeys('u1', { salt: 's', wrappedMasterKey: 'w', recoveryWrappedKey: 'r' });
    expect(res.success).toBe(true);
    expect(r.updateUser).toHaveBeenCalledWith('u1', { encryptionSalt: 's', wrappedMasterKey: 'w', recoveryWrappedKey: 'r', encryptionVersion: 1 });
  });

  it('setPassphrase : pose le flag', async () => {
    r.updateUser.mockResolvedValue({ id: 'u1' });
    await svc.setPassphrase('u1');
    expect(r.updateUser).toHaveBeenCalledWith('u1', { encryptionPassphrase: true });
  });

  it('resetPasswordWithRecovery : code valide → re-hash + maj clés si fournies', async () => {
    r.findValidCode.mockResolvedValue({ id: 'c1' });
    r.findByEmail.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    r.updateUser.mockResolvedValue({ id: 'u1' });
    const res = await svc.resetPasswordWithRecovery({ email: 'a@b.com', code: '123456', newPassword: 'nouveau-long-123', newSalt: 's', newWrappedMasterKey: 'w' });
    expect(res.success).toBe(true);
    const patch = r.updateUser.mock.calls[0][1];
    expect(patch.encryptionSalt).toBe('s');
    expect(await argon2.verify(patch.password, 'nouveau-long-123')).toBe(true);
  });

  it('resetPasswordWithRecovery : code invalide → fail 400', async () => {
    r.findValidCode.mockResolvedValue(undefined);
    expect((await svc.resetPasswordWithRecovery({ email: 'a@b.com', code: 'x', newPassword: 'nouveau-long-123' })).success).toBe(false);
  });
});
```

- [ ] **Step 2:** Run → FAIL.

- [ ] **Step 3:** `src/auth/encryption.service.ts` (ops user ; migrate/wipe ajoutés Task 4) :
```ts
import { Inject, Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { AuthRepository } from './auth.repository';
import { DRIZZLE, type DrizzleDB } from '../db/drizzle.constants';
import { ok, fail, type Result } from './auth.result';
import type { SetupEncryptionKeysDto, ResetWithRecoveryDto } from './dto/auth.dto';

@Injectable()
export class EncryptionService {
  constructor(
    private readonly repo: AuthRepository,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  async setKeys(userId: string, dto: SetupEncryptionKeysDto): Promise<Result<null>> {
    await this.repo.updateUser(userId, {
      encryptionSalt: dto.salt, wrappedMasterKey: dto.wrappedMasterKey,
      recoveryWrappedKey: dto.recoveryWrappedKey, encryptionVersion: 1,
    });
    return ok(null);
  }

  async setPassphrase(userId: string): Promise<Result<null>> {
    await this.repo.updateUser(userId, { encryptionPassphrase: true });
    return ok(null);
  }

  async resetPasswordWithRecovery(dto: ResetWithRecoveryDto): Promise<Result<null>> {
    const valid = await this.repo.findValidCode(dto.email, dto.code);
    if (!valid) return fail(400, 'Code invalide ou expiré');
    const user = await this.repo.findByEmail(dto.email);
    if (!user) return fail(404, 'Compte introuvable');
    const patch: Record<string, unknown> = { password: await argon2.hash(dto.newPassword) };
    if (dto.newSalt && dto.newWrappedMasterKey) {
      patch.encryptionSalt = dto.newSalt;
      patch.wrappedMasterKey = dto.newWrappedMasterKey;
    }
    await this.repo.updateUser(user.id, patch);
    await this.repo.deleteCodes(dto.email);
    return ok(null);
  }
}
```

- [ ] **Step 4:** Run → PASS. **Step 5: Commit** — `feat(b3): EncryptionService ops user (keys/passphrase/recovery)`

---

## Task 4: EncryptionService — migrate + wipe

**Files:** Modify `src/auth/encryption.service.ts`

- [ ] **Step 1:** Ajouter en tête de fichier l'import du schéma + helpers Drizzle :
```ts
import { and, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { MigrateEncryptionDto } from './dto/auth.dto';
```

- [ ] **Step 2:** Ajouter les maps (constantes module, hors classe) :
```ts
const MIGRATE_TABLES: Record<string, { table: any; hasUserId: boolean }> = {
  bankAccounts: { table: schema.bankAccounts, hasUserId: true },
  envelopes: { table: schema.envelopes, hasUserId: true },
  envelopeTransactions: { table: schema.envelopeTransactions, hasUserId: false },
  loans: { table: schema.loans, hasUserId: true },
  loanTransactions: { table: schema.loanTransactions, hasUserId: false },
  recurringEntries: { table: schema.recurringEntries, hasUserId: true },
  salaryArchives: { table: schema.salaryArchives, hasUserId: true },
  patients: { table: schema.patients, hasUserId: true },
  practitioners: { table: schema.practitioners, hasUserId: true },
  appointments: { table: schema.appointments, hasUserId: true },
  prescriptions: { table: schema.prescriptions, hasUserId: true },
  medications: { table: schema.medications, hasUserId: true },
  documents: { table: schema.documents, hasUserId: true },
};

const CLEAR_COLUMNS: Record<string, Record<string, unknown>> = {
  bankAccounts: { name: '[chiffré]', color: null, dotColor: null },
  envelopes: { name: '[chiffré]', type: 'épargne', balance: '0', target: null, color: null, dueDay: null },
  envelopeTransactions: { amount: '0', date: '1970-01-01' },
  loans: { person: '[chiffré]', direction: 'lent', amount: '0', remaining: '0', description: null, date: '1970-01-01', dueDate: null, dueDay: null },
  loanTransactions: { amount: '0', date: '1970-01-01' },
  recurringEntries: { label: '[chiffré]', amount: '0', type: 'expense', dayOfMonth: null, date: null, category: null, payslipKey: null },
  salaryArchives: { month: '0000-00', salary: '0', totalExpenses: '0', totalSpendings: '0', spendings: [], payslipKey: null },
  patients: { firstName: '[chiffré]', lastName: '[chiffré]', birthDate: '1970-01-01', color: null, notes: null },
  practitioners: { name: '[chiffré]', type: 'autre', phone: null, email: null, address: null, bookingUrl: null },
  appointments: { date: '1970-01-01', time: '00:00', status: 'scheduled', reason: null, outcome: null },
  prescriptions: { issuedDate: '1970-01-01', validUntil: null, documentUrl: null, notes: null },
  medications: { name: '[chiffré]', type: 'autre', dosage: '[chiffré]', quantity: 0, dailyRate: '1', startDate: '1970-01-01', alertDaysBefore: 7, skipDays: [] },
  documents: { type: 'autre', title: '[chiffré]', date: '1970-01-01', fileUrl: null, notes: null },
};

const WIPE_TABLES = [
  schema.bankAccounts, schema.envelopes, schema.loans, schema.recurringEntries,
  schema.salaryArchives, schema.patients, schema.practitioners, schema.appointments,
  schema.prescriptions, schema.medications, schema.documents,
];
```

- [ ] **Step 3:** Ajouter les méthodes à `EncryptionService` :
```ts
  async migrate(userId: string, dto: MigrateEncryptionDto): Promise<Result<null>> {
    for (const [tableName, rows] of Object.entries(dto.data)) {
      const mapping = MIGRATE_TABLES[tableName];
      if (!mapping) continue;
      const clear = CLEAR_COLUMNS[tableName] ?? {};
      for (const row of rows) {
        const conditions = [eq(mapping.table.id, row.id)];
        if (mapping.hasUserId) conditions.push(eq(mapping.table.userId, userId));
        await this.db.update(mapping.table).set({ encryptedData: row.encryptedData, ...clear }).where(and(...conditions));
      }
    }
    await this.repo.updateUser(userId, {
      encryptionSalt: dto.keyMaterial.salt, wrappedMasterKey: dto.keyMaterial.wrappedMasterKey,
      recoveryWrappedKey: dto.keyMaterial.recoveryWrappedKey, encryptionVersion: 1,
    });
    return ok(null);
  }

  async wipe(userId: string): Promise<Result<null>> {
    for (const table of WIPE_TABLES) {
      await this.db.delete(table).where(eq((table as any).userId, userId));
    }
    await this.repo.updateUser(userId, {
      encryptionSalt: null, wrappedMasterKey: null, recoveryWrappedKey: null, encryptionVersion: 0,
    });
    return ok(null);
  }
```

- [ ] **Step 4:** `pnpm tsc --noEmit` clean + `pnpm test` (unit existants verts). **Step 5: Commit** — `feat(b3): EncryptionService migrate + wipe (13 tables)`

---

## Task 5: EncryptionController + wiring

**Files:** Create `src/auth/encryption.controller.ts`; Modify `src/auth/auth.module.ts`

- [ ] **Step 1:** `src/auth/encryption.controller.ts` :
```ts
import { Body, Controller, HttpCode, HttpException, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EncryptionService } from './encryption.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import {
  setupEncryptionKeysSchema, encryptionPassphraseSchema, migrateEncryptionSchema, resetWithRecoverySchema,
} from './dto/auth.dto';
import type { SetupEncryptionKeysDto, MigrateEncryptionDto, ResetWithRecoveryDto } from './dto/auth.dto';

const STRICT = { default: { limit: 10, ttl: 900_000 } };
function httpFrom(r: { status: number; error: string; code?: string }): HttpException {
  return new HttpException(r.code ? { message: r.error, code: r.code } : r.error, r.status);
}

@Controller('auth')
export class EncryptionController {
  constructor(private readonly enc: EncryptionService) {}

  @UseGuards(JwtAuthGuard, CsrfGuard) @Patch('me/encryption-keys') @HttpCode(200)
  async setKeys(@CurrentUser() u: AuthUser, @Body(new ZodValidationPipe(setupEncryptionKeysSchema)) dto: SetupEncryptionKeysDto) {
    await this.enc.setKeys(u.id, dto);
    return { message: 'Clés de chiffrement configurées' };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard) @Post('me/encryption-passphrase') @HttpCode(200)
  async setPassphrase(@CurrentUser() u: AuthUser, @Body(new ZodValidationPipe(encryptionPassphraseSchema)) _dto: { passphrase: string }) {
    await this.enc.setPassphrase(u.id);
    return { message: 'Passphrase de chiffrement définie' };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard) @Post('me/migrate-encryption') @HttpCode(200)
  async migrate(@CurrentUser() u: AuthUser, @Body(new ZodValidationPipe(migrateEncryptionSchema)) dto: MigrateEncryptionDto) {
    await this.enc.migrate(u.id, dto);
    return { message: 'Migration chiffrement terminée' };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard) @Post('me/wipe-encryption') @HttpCode(200)
  async wipe(@CurrentUser() u: AuthUser) {
    await this.enc.wipe(u.id);
    return { message: 'Données chiffrées supprimées' };
  }

  @Throttle(STRICT) @Post('reset-password-with-recovery') @HttpCode(200)
  async resetWithRecovery(@Body(new ZodValidationPipe(resetWithRecoverySchema)) dto: ResetWithRecoveryDto) {
    const r = await this.enc.resetPasswordWithRecovery(dto);
    if (!r.success) throw httpFrom(r);
    return { message: 'Mot de passe réinitialisé avec succès' };
  }
}
```

- [ ] **Step 2:** Dans `src/auth/auth.module.ts` : importer `EncryptionService` + `EncryptionController`, ajouter `EncryptionController` à `controllers` et `EncryptionService` à `providers`.

- [ ] **Step 3:** `pnpm test` + `pnpm tsc --noEmit` clean. Boot smoke (DB up) : `pnpm start:dev`, vérifier que l'app démarre + routes `/api/auth/me/encryption-keys` etc. mappées dans les logs ; arrêter.

- [ ] **Step 4: Commit** — `feat(b3): EncryptionController + endpoints E2EE + wiring`

---

## Task 6: Tests d'intégration migrate + wipe (vraie DB)

**Files:** Create `test/encryption.integration-spec.ts`

- [ ] **Step 1:** `test/encryption.integration-spec.ts` (utilise le client postgres-js direct, comme `schema-integrity.integration-spec.ts`, pour insérer/asserter ; exécute la logique via une instance `EncryptionService` câblée sur un drizzle client réel) :
```ts
import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import { EncryptionService } from '../src/auth/encryption.service';

const sql = postgres(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });
// repo minimal réel pour updateUser
const repo = {
  updateUser: async (id: string, patch: any) => { await db.update(schema.users).set(patch).where(eq(schema.users.id, id)); return undefined as any; },
} as any;
const enc = new EncryptionService(repo, db as any);

async function makeUser(): Promise<string> {
  const [u] = await db.insert(schema.users).values({ email: `enc+${Date.now()}@dashflow.test`, password: 'x' }).returning();
  return u.id;
}

describe('EncryptionService intégration', () => {
  afterAll(async () => { await sql.end(); });

  it('migrate : écrit encryptedData + clear name sur bankAccounts', async () => {
    const userId = await makeUser();
    const [acc] = await db.insert(schema.bankAccounts).values({ userId, name: 'Compte courant', initialBalance: '100' }).returning();
    await enc.migrate(userId, { keyMaterial: { salt: 's', wrappedMasterKey: 'w', recoveryWrappedKey: 'r' }, data: { bankAccounts: [{ id: acc.id, encryptedData: 'ENC' }] } });
    const [after] = await db.select().from(schema.bankAccounts).where(eq(schema.bankAccounts.id, acc.id));
    expect(after.encryptedData).toBe('ENC');
    expect(after.name).toBe('[chiffré]');
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    expect(user.encryptionVersion).toBe(1);
  });

  it('wipe : supprime les lignes + reset état', async () => {
    const userId = await makeUser();
    await db.insert(schema.bankAccounts).values({ userId, name: 'X', initialBalance: '0' });
    await enc.wipe(userId);
    const rows = await db.select().from(schema.bankAccounts).where(eq(schema.bankAccounts.userId, userId));
    expect(rows).toHaveLength(0);
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    expect(user.encryptionVersion).toBe(0);
    expect(user.wrappedMasterKey).toBeNull();
  });
});
```

- [ ] **Step 2:** Run `pnpm test:integration` (DB up) → 2 nouveaux PASS (+ l'intégrité schéma existante). **Step 3: Commit** — `test(b3): intégration migrate + wipe`

---

## Self-Review

**Couverture du spec :**
- 5 endpoints → Tasks 5 ✓ (+ service Tasks 3,4)
- DTOs E2EE → Task 1 ✓
- Réconciliation reset-password (retrait enforcement) → Tasks 1,2 ✓ ; `/me/password`+`/me/set-password` re-wrap conservé (intouchés) ✓
- migrate (13 tables + clearColumns exact + transactions par id) → Task 4 ✓
- wipe (11 tables userId + cascade + reset état) → Task 4 ✓
- reset-with-recovery (maj clés optionnelle, sans 400) → Tasks 3,5 ✓
- Tests unit + intégration (critères 1-7) → Tasks 2,3,6 ✓

**Placeholders :** aucun ; `CLEAR_COLUMNS`/`MIGRATE_TABLES`/`WIPE_TABLES` inlinés intégralement.

**Cohérence des types :** `EncryptionService(repo, db)` (Task 3) cohérent Tasks 4,6. `setupEncryptionKeysSchema`/`migrateEncryptionSchema`/`resetWithRecoverySchema` (Task 1) câblés Task 5. `httpFrom` réutilise la forme de B2 (`code?`). `WIPE_TABLES` = 11 tables avec userId (transactions exclues, retirées par cascade). `resetPasswordSchema` allégé (Task 1) cohérent avec `AuthService.resetPassword` simplifié (Task 2).
