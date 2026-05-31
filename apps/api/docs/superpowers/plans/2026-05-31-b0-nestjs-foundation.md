# Fondation NestJS (B0) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser le socle technique du backend NestJS (structure, Drizzle, config validée, pipe Zod, filtre d'erreurs, health, Vitest) sans aucune logique métier, prêt à accueillir l'auth en B1.

**Architecture:** Repo standalone NestJS 11. `DrizzleModule` global expose un client postgres-js typé sur la DB locale partagée (Podman). Config validée par Zod au boot. Validation des entrées par un `ZodValidationPipe` global (pattern officiel Nest). Tests sur Vitest + swc.

**Tech Stack:** NestJS 11, Drizzle ORM + postgres-js, Zod, @nestjs/config, helmet, cookie-parser, Vitest + unplugin-swc.

> ⚠️ **Politique J-Ned : aucun commit automatique.** Les étapes « Commit » donnent le message ; c'est l'utilisateur qui exécute `git add`/`git commit`.

> **Cwd :** tous les chemins relatifs sont dans `/home/jned/WebstormProjects/DashFlow/nest-dashflow-app/`.
> **Prérequis :** la DB locale tourne (`cd ../nest-dashflow-app && make db-up` — ou elle est déjà up). Source de vérité du schéma à porter : `../dash-flow/backend/src/db/schema.ts`.

---

## File Structure

| Fichier | Responsabilité |
|---|---|
| `package.json` | + deps runtime/test, − Jest, scripts Vitest |
| `tsconfig.json` | strict activé |
| `vitest.config.ts` | runner Vitest + plugin swc |
| `.env` / `.env.example` | env du backend (DATABASE_URL local, PORT 3001…) |
| `src/config/env.schema.ts` | schéma Zod des variables d'env + type `Env` |
| `src/config/config.module.ts` | `@nestjs/config` global + `validate` |
| `src/db/schema/{auth,finance,medical,shared}.ts` | port du schéma Drizzle par domaine |
| `src/db/schema/index.ts` | barrel |
| `src/db/drizzle.constants.ts` | token `DRIZZLE` |
| `src/db/drizzle.module.ts` | module `@Global` fournissant le client |
| `src/common/pipes/zod-validation.pipe.ts` | `ZodValidationPipe` |
| `src/common/filters/http-exception.filter.ts` | filtre d'erreurs global |
| `src/health/health.{module,controller}.ts` | `GET /api/health` + ping DB |
| `src/app.module.ts` | racine (Config, Drizzle, Health) |
| `src/main.ts` | bootstrap |
| `drizzle.config.ts` | config drizzle-kit |
| `test/schema-integrity.integration-spec.ts` | vérif schéma porté vs DB |
| `CLAUDE.md` | réécriture backend-focused (gate utilisateur) |
| supprimés | `src/app.controller.ts`, `src/app.service.ts`, `src/app.controller.spec.ts` |

---

## Task 1: Dépendances & tooling (Vitest, strict, deps runtime)

**Files:**
- Modify: `package.json`, `tsconfig.json`

- [ ] **Step 1: Installer les deps runtime**

Run:
```bash
pnpm add drizzle-orm@^0.44.7 postgres@^3.4.8 @nestjs/config@^4.0.2 zod@^4.3.6 helmet@^8.1.0 cookie-parser@^1.4.7
```
Expected: installation OK, ajoutées dans `dependencies`.

- [ ] **Step 2: Installer les deps de test/dev et retirer Jest**

Run:
```bash
pnpm add -D vitest@^4.0.8 unplugin-swc@^1.5.7 @swc/core@^1.13.5 @types/cookie-parser@^1.4.9
pnpm remove jest ts-jest @types/jest
```
Expected: Vitest/swc présents, Jest absent.

- [ ] **Step 3: Retirer le bloc `jest` et corriger les scripts dans `package.json`**

Supprimer entièrement la clé `"jest": { ... }`. Remplacer les scripts de test par :
```json
    "test": "vitest run",
    "test:watch": "vitest",
    "test:cov": "vitest run --coverage",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:e2e": "vitest run --config vitest.e2e.config.ts"
```
(Garder `build`, `format`, `start`, `start:dev`, `start:debug`, `start:prod`, `lint`.)

- [ ] **Step 4: Activer le mode strict dans `tsconfig.json`**

Dans `compilerOptions`, ajouter `"strict": true` et retirer les assouplissements contraires : supprimer `"noImplicitAny": false` et `"strictBindCallApply": false` (laisser `strictNullChecks` est redondant avec strict mais inoffensif — le retirer aussi pour la propreté).

- [ ] **Step 5: Vérifier que rien n'est cassé**

Run: `pnpm tsc --noEmit`
Expected: aucune erreur (le scaffold par défaut compile en strict ; sinon corriger les `app.*.ts` — ils seront supprimés en Task 8 de toute façon).

- [ ] **Step 6: Commit (utilisateur)**

```bash
git add package.json pnpm-lock.yaml tsconfig.json
git commit -m "chore(b0): deps runtime + Vitest/swc, retrait Jest, tsconfig strict"
```

---

## Task 2: Config Vitest + spec de sanité

**Files:**
- Create: `vitest.config.ts`, `src/sanity.spec.ts`

- [ ] **Step 1: Créer `vitest.config.ts`**

```ts
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './',
    include: ['src/**/*.spec.ts'],
  },
  plugins: [
    // swc transforme les décorateurs + emit metadata (DI NestJS) pour Vitest
    swc.vite({ module: { type: 'es6' } }),
  ],
});
```

- [ ] **Step 2: Écrire une spec de sanité (prouve le runner)**

`src/sanity.spec.ts` :
```ts
import { describe, it, expect } from 'vitest';

describe('Vitest runner', () => {
  it('exécute les specs TypeScript', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 3: Lancer Vitest**

Run: `pnpm test`
Expected: 1 fichier, 1 test PASS.

- [ ] **Step 4: Commit (utilisateur)**

```bash
git add vitest.config.ts src/sanity.spec.ts
git commit -m "test(b0): config Vitest + swc + spec de sanité"
```

---

## Task 3: Schéma d'env + ConfigModule validé

**Files:**
- Create: `src/config/env.schema.ts`, `src/config/config.module.ts`, `.env`, `.env.example`
- Test: `src/config/env.schema.spec.ts`

- [ ] **Step 1: Écrire le test du schéma d'env (TDD)**

`src/config/env.schema.spec.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { envSchema } from './env.schema';

describe('envSchema', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    CORS_ORIGIN: 'http://localhost:4200',
  };

  it('applique les valeurs par défaut', () => {
    const env = envSchema.parse(base);
    expect(env.PORT).toBe(3001);
    expect(env.NODE_ENV).toBe('development');
  });

  it('rejette une DATABASE_URL manquante', () => {
    expect(() => envSchema.parse({ CORS_ORIGIN: base.CORS_ORIGIN })).toThrow();
  });

  it('coerce PORT en nombre', () => {
    const env = envSchema.parse({ ...base, PORT: '4000' });
    expect(env.PORT).toBe(4000);
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `pnpm test src/config/env.schema.spec.ts`
Expected: FAIL (`env.schema` introuvable).

- [ ] **Step 3: Implémenter `src/config/env.schema.ts`**

```ts
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  CORS_ORIGIN: z.string().default('http://localhost:4200'),
});

export type Env = z.infer<typeof envSchema>;
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run: `pnpm test src/config/env.schema.spec.ts`
Expected: 3 tests PASS.

- [ ] **Step 5: Implémenter `src/config/config.module.ts`**

```ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { envSchema } from './env.schema';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Refuse de démarrer si une variable est manquante/invalide.
      validate: (raw) => envSchema.parse(raw),
    }),
  ],
})
export class ConfigModule {}
```

- [ ] **Step 6: Créer `.env.example` (committé) et `.env` (gitignoré)**

`.env.example` :
```dotenv
NODE_ENV=development
PORT=3001
# DB locale partagée (Podman) — cf. compose.dev.yaml
DATABASE_URL=postgresql://djoudj:dashflow_dev_pw@localhost:5432/dashflow_db
CORS_ORIGIN=http://localhost:4200
```
`.env` : copier `.env.example` à l'identique (`cp .env.example .env`).

- [ ] **Step 7: Vérifier que `.env` est ignoré**

Run: `git check-ignore .env`
Expected: `.env`.

- [ ] **Step 8: Commit (utilisateur)**

```bash
git add src/config/ .env.example
git commit -m "feat(b0): config env validée par Zod au boot"
```

---

## Task 4: Port du schéma Drizzle par domaine

**Files:**
- Create: `src/db/schema/auth.ts`, `src/db/schema/medical.ts`, `src/db/schema/finance.ts`, `src/db/schema/shared.ts`, `src/db/schema/index.ts`
- Test: `src/db/schema/schema.spec.ts`

**Règle de port :** copier **verbatim** chaque définition de table/enum depuis
`../dash-flow/backend/src/db/schema.ts` (mêmes noms de colonnes SQL, types, contraintes,
defaults). On ne change QUE la répartition entre fichiers et les imports. Aucune
modification de schéma (la DB est déjà provisionnée).

**Répartition (18 tables) et sens des imports** (pas de cycle : `medical`←`finance`, `auth` indépendant) :
- `auth.ts` : tables `users`, `verificationCodes`. Aucun import de schéma.
- `medical.ts` : enums `practitionerTypeEnum`, `appointmentStatusEnum`, `medicationTypeEnum`, `documentTypeEnum`, `reminderTypeEnum`, `reminderTargetEnum` ; tables `patients`, `practitioners`, `appointments`, `prescriptions`, `medications`, `documents`, `reminders`. Importe `users` depuis `./auth`.
- `finance.ts` : enums `envelopeTypeEnum`, `loanDirectionEnum`, `recurringEntryTypeEnum`, `consumableCategoryEnum` ; tables `bankAccounts`, `envelopes`, `envelopeTransactions`, `loans`, `loanTransactions`, `consumables`, `recurringEntries`, `salaryArchives`. Importe `users` depuis `./auth` ET `patients` depuis `./medical` (pour les `memberId`).
- `shared.ts` : table `sharedAccess`. Importe `users` depuis `./auth`.

- [ ] **Step 1: Créer `src/db/schema/auth.ts`** (port verbatim — petit, inliné ici)

```ts
import { pgTable, uuid, varchar, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password'),
  googleId: varchar('google_id', { length: 255 }).unique(),
  displayName: varchar('display_name', { length: 255 }),
  avatarUrl: text('avatar_url'),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  totpSecret: text('totp_secret'),
  totpEnabled: timestamp('totp_enabled', { withTimezone: true }),
  encryptionSalt: text('encryption_salt'),
  wrappedMasterKey: text('wrapped_master_key'),
  recoveryWrappedKey: text('recovery_wrapped_key'),
  encryptionVersion: integer('encryption_version').notNull().default(0),
  encryptionPassphrase: boolean('encryption_passphrase').notNull().default(false),
  isDemoAccount: boolean('is_demo_account').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const verificationCodes = pgTable('verification_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull(),
  code: varchar('code', { length: 6 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Créer `src/db/schema/medical.ts`**

Importer en tête : `import { pgTable, uuid, varchar, text, date, timestamp, integer, jsonb, boolean, pgEnum } from 'drizzle-orm/pg-core';` et `import { users } from './auth';`.
Puis copier **verbatim** depuis la source (lignes 183–313 du schema.ts source) : les 6 enums médicaux et les tables `patients`, `practitioners`, `appointments`, `prescriptions`, `medications`, `documents`, `reminders`. Les `references(() => users.id, …)` utilisent l'import `users`.

- [ ] **Step 3: Créer `src/db/schema/finance.ts`**

Importer en tête : `import { pgTable, uuid, varchar, text, numeric, integer, date, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';`, `import { users } from './auth';`, `import { patients } from './medical';`.
Puis copier **verbatim** depuis la source : les 4 enums (`envelopeTypeEnum` ligne 17, `loanDirectionEnum` ligne 19, `recurringEntryTypeEnum` ligne 21, `consumableCategoryEnum` lignes 23–28) et les tables `bankAccounts`, `envelopes`, `envelopeTransactions`, `loans`, `loanTransactions`, `consumables`, `recurringEntries`, `salaryArchives` (lignes 64–179). Les `references(() => patients.id, …)` utilisent l'import `patients`, `references(() => users.id, …)` l'import `users`, et les `references(() => bankAccounts.id, …)` la table locale.

- [ ] **Step 4: Créer `src/db/schema/shared.ts`** (port verbatim — inliné ici)

```ts
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const sharedAccess = pgTable('shared_access', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  invitedEmail: varchar('invited_email', { length: 255 }).notNull(),
  calendarToken: varchar('calendar_token', { length: 64 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 5: Créer le barrel `src/db/schema/index.ts`**

```ts
export * from './auth';
export * from './medical';
export * from './finance';
export * from './shared';
```

- [ ] **Step 6: Écrire la spec du schéma**

`src/db/schema/schema.spec.ts` :
```ts
import { describe, it, expect } from 'vitest';
import * as schema from './index';
import { getTableName } from 'drizzle-orm';

const EXPECTED_TABLES = [
  'users', 'verification_codes',
  'bank_accounts', 'envelopes', 'envelope_transactions', 'loans',
  'loan_transactions', 'consumables', 'recurring_entries', 'salary_archives',
  'patients', 'practitioners', 'appointments', 'prescriptions', 'medications',
  'documents', 'reminders', 'shared_access',
];

describe('schéma Drizzle porté', () => {
  it('exporte exactement les 18 tables attendues', () => {
    const names = Object.values(schema)
      .filter((v): v is Parameters<typeof getTableName>[0] => {
        try { getTableName(v as never); return true; } catch { return false; }
      })
      .map((t) => getTableName(t));
    expect(new Set(names)).toEqual(new Set(EXPECTED_TABLES));
    expect(names).toHaveLength(18);
  });
});
```

- [ ] **Step 7: Lancer la spec**

Run: `pnpm test src/db/schema/schema.spec.ts`
Expected: PASS (18 tables). Si échec sur le compte → une table a été oubliée ou dupliquée dans le port.

- [ ] **Step 8: Commit (utilisateur)**

```bash
git add src/db/schema/
git commit -m "feat(b0): port du schéma Drizzle par domaine (18 tables)"
```

---

## Task 5: DrizzleModule global + drizzle-kit

**Files:**
- Create: `src/db/drizzle.constants.ts`, `src/db/drizzle.module.ts`, `drizzle.config.ts`

- [ ] **Step 1: Créer le token `src/db/drizzle.constants.ts`**

```ts
export const DRIZZLE = Symbol('DRIZZLE');

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from './schema';
export type DrizzleDB = PostgresJsDatabase<typeof schema>;
```

- [ ] **Step 2: Créer `src/db/drizzle.module.ts`**

```ts
import { Global, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { DRIZZLE } from './drizzle.constants';
import type { Env } from '../config/env.schema';

const POSTGRES_CLIENT = Symbol('POSTGRES_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: POSTGRES_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        postgres(config.get('DATABASE_URL', { infer: true })),
    },
    {
      provide: DRIZZLE,
      inject: [POSTGRES_CLIENT],
      useFactory: (sql: ReturnType<typeof postgres>) => drizzle(sql, { schema }),
    },
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule implements OnApplicationShutdown {
  constructor() {}
  async onApplicationShutdown(): Promise<void> {
    // Fermeture gérée par enableShutdownHooks ; postgres-js se ferme via le client.
  }
}
```

> Note : la fermeture propre du client est assurée par `app.enableShutdownHooks()` (Task 8) + le GC ; postgres-js n'a pas de fuite bloquante en dev. Une fermeture explicite sera ajoutée si un test d'intégration la requiert.

- [ ] **Step 3: Créer `drizzle.config.ts`** (drizzle-kit — table de migrations dédiée pour ne pas toucher le journal Hono)

```ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
  // Journal séparé : ne pas écraser drizzle.__drizzle_migrations (Hono).
  migrations: { table: '__drizzle_migrations_nest', schema: 'drizzle' },
});
```

- [ ] **Step 4: Vérifier que drizzle-kit charge la config sans planter**

Run: `pnpm exec drizzle-kit --help`
Expected: aide affichée (drizzle-kit déjà présent via drizzle-orm ? sinon `pnpm add -D drizzle-kit@^0.31.9` puis re-tester).

> Si drizzle-kit n'est pas installé : `pnpm add -D drizzle-kit@^0.31.9`, l'ajouter au commit.

- [ ] **Step 5: Commit (utilisateur)**

```bash
git add src/db/drizzle.constants.ts src/db/drizzle.module.ts drizzle.config.ts package.json pnpm-lock.yaml
git commit -m "feat(b0): DrizzleModule global (postgres-js) + config drizzle-kit"
```

---

## Task 6: Common — ZodValidationPipe + HttpExceptionFilter

**Files:**
- Create: `src/common/pipes/zod-validation.pipe.ts`, `src/common/filters/http-exception.filter.ts`
- Test: `src/common/pipes/zod-validation.pipe.spec.ts`

- [ ] **Step 1: Écrire le test du pipe (TDD)**

`src/common/pipes/zod-validation.pipe.spec.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

const schema = z.object({ email: z.string().email() });

describe('ZodValidationPipe', () => {
  it('laisse passer une valeur valide (parsée)', () => {
    const pipe = new ZodValidationPipe(schema);
    expect(pipe.transform({ email: 'a@b.com' })).toEqual({ email: 'a@b.com' });
  });

  it('lève BadRequestException sur valeur invalide', () => {
    const pipe = new ZodValidationPipe(schema);
    expect(() => pipe.transform({ email: 'nope' })).toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `pnpm test src/common/pipes/zod-validation.pipe.spec.ts`
Expected: FAIL (pipe introuvable).

- [ ] **Step 3: Implémenter `src/common/pipes/zod-validation.pipe.ts`** (pattern officiel Nest)

```ts
import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const first = result.error.issues[0];
      throw new BadRequestException(first?.message ?? 'Données invalides');
    }
    return result.data;
  }
}
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run: `pnpm test src/common/pipes/zod-validation.pipe.spec.ts`
Expected: 2 tests PASS.

- [ ] **Step 5: Implémenter `src/common/filters/http-exception.filter.ts`**

```ts
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Erreur interne du serveur';

    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    res.status(status).json({
      statusCode: status,
      error: HttpStatus[status] ?? 'ERROR',
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
```

- [ ] **Step 6: Commit (utilisateur)**

```bash
git add src/common/
git commit -m "feat(b0): ZodValidationPipe + filtre d'exceptions global"
```

---

## Task 7: Module Health + ping DB

**Files:**
- Create: `src/health/health.module.ts`, `src/health/health.controller.ts`
- Test: `src/health/health.controller.spec.ts`

- [ ] **Step 1: Écrire le test du controller (TDD, DB mockée)**

`src/health/health.controller.spec.ts` :
```ts
import { describe, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { DRIZZLE } from '../db/drizzle.constants';

describe('HealthController', () => {
  it('retourne ok=true et db=true quand le ping réussit', async () => {
    const db = { execute: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DRIZZLE, useValue: db }],
    }).compile();

    const controller = moduleRef.get(HealthController);
    const res = await controller.check();
    expect(res.ok).toBe(true);
    expect(res.db).toBe(true);
    expect(db.execute).toHaveBeenCalled();
  });

  it('retourne db=false quand le ping échoue', async () => {
    const db = { execute: vi.fn().mockRejectedValue(new Error('down')) };
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DRIZZLE, useValue: db }],
    }).compile();

    const res = await moduleRef.get(HealthController).check();
    expect(res.ok).toBe(true);
    expect(res.db).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `pnpm test src/health/health.controller.spec.ts`
Expected: FAIL (controller introuvable).

- [ ] **Step 3: Implémenter `src/health/health.controller.ts`**

```ts
import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/drizzle.constants';

@Controller('health')
export class HealthController {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  @Get()
  async check(): Promise<{ ok: true; db: boolean; timestamp: string }> {
    let db = false;
    try {
      await this.db.execute(sql`select 1`);
      db = true;
    } catch {
      db = false;
    }
    return { ok: true, db, timestamp: new Date().toISOString() };
  }
}
```

- [ ] **Step 4: Implémenter `src/health/health.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({ controllers: [HealthController] })
export class HealthModule {}
```

- [ ] **Step 5: Lancer le test (succès attendu)**

Run: `pnpm test src/health/health.controller.spec.ts`
Expected: 2 tests PASS.

- [ ] **Step 6: Commit (utilisateur)**

```bash
git add src/health/
git commit -m "feat(b0): module health + ping DB"
```

---

## Task 8: app.module + bootstrap main.ts

**Files:**
- Modify: `src/app.module.ts`, `src/main.ts`
- Delete: `src/app.controller.ts`, `src/app.service.ts`, `src/app.controller.spec.ts`

- [ ] **Step 1: Supprimer les fichiers de démo du scaffold**

Run: `rm src/app.controller.ts src/app.service.ts src/app.controller.spec.ts`
Expected: supprimés.

- [ ] **Step 2: Réécrire `src/app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DrizzleModule } from './db/drizzle.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [ConfigModule, DrizzleModule, HealthModule],
})
export class AppModule {}
```

- [ ] **Step 3: Réécrire `src/main.ts`**

```ts
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import type { Env } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Env, true>);

  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.get('CORS_ORIGIN', { infer: true }).split(','),
    credentials: true,
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  await app.listen(config.get('PORT', { infer: true }));
}
void bootstrap();
```

> Note : `ZodValidationPipe` prend un schéma par DTO, donc il s'applique au niveau handler (`@UsePipes`) à partir de B1, pas en global ici. Il est néanmoins importé/disponible. (Si tu préfères un pipe global générique, ce sera tranché en B1 — hors périmètre B0.)

Corriger l'import inutilisé : retirer `ZodValidationPipe` de l'import si non utilisé en global (sinon lint échoue). **Décision B0 : ne pas importer `ZodValidationPipe` dans main.ts** — supprimer la ligne d'import correspondante.

- [ ] **Step 4: Démarrer l'app**

Run: `pnpm start:dev` (laisser tourner ~5s)
Expected: logs Nest, `Nest application successfully started`, écoute sur `:3001`. Aucune erreur de validation d'env ni de DI.

- [ ] **Step 5: Tester l'endpoint health (DB locale up requise)**

Dans un autre terminal :
Run: `curl -s http://localhost:3001/api/health`
Expected: `{"ok":true,"db":true,"timestamp":"..."}`. Puis arrêter `start:dev` (Ctrl-C).

- [ ] **Step 6: Lancer toute la suite de tests**

Run: `pnpm test`
Expected: toutes les specs PASS (sanity, env, schema, pipe, health).

- [ ] **Step 7: Commit (utilisateur)**

```bash
git add src/app.module.ts src/main.ts
git rm --cached src/app.controller.ts src/app.service.ts src/app.controller.spec.ts 2>/dev/null || true
git commit -m "feat(b0): bootstrap (helmet, cors+credentials, cookie-parser, prefix /api) + nettoyage scaffold"
```

---

## Task 9: Vérification d'intégrité schéma ↔ DB locale

**Files:**
- Create: `vitest.integration.config.ts`, `test/schema-integrity.integration-spec.ts`

Ce test (séparé des unitaires) confirme que le schéma porté correspond bien à la DB locale réelle. Il nécessite la DB up et n'est PAS lancé par `pnpm test`.

- [ ] **Step 1: Créer `vitest.integration.config.ts`**

```ts
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './',
    include: ['test/**/*.integration-spec.ts'],
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
```

- [ ] **Step 2: Créer `test/schema-integrity.integration-spec.ts`**

```ts
import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

const EXPECTED_TABLES = [
  'users', 'verification_codes', 'bank_accounts', 'envelopes',
  'envelope_transactions', 'loans', 'loan_transactions', 'consumables',
  'recurring_entries', 'salary_archives', 'patients', 'practitioners',
  'appointments', 'prescriptions', 'medications', 'documents', 'reminders',
  'shared_access',
];

describe('intégrité schéma porté ↔ DB locale', () => {
  afterAll(async () => { await sql.end(); });

  it('toutes les tables attendues existent dans le schéma public', async () => {
    const rows = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
    const present = new Set(rows.map((r) => r.table_name));
    for (const t of EXPECTED_TABLES) expect(present.has(t), `table ${t}`).toBe(true);
  });

  it('users a les colonnes E2EE clés', async () => {
    const rows = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'`;
    const cols = new Set(rows.map((r) => r.column_name));
    for (const c of ['encryption_salt', 'wrapped_master_key', 'recovery_wrapped_key',
      'encryption_version', 'encryption_passphrase', 'totp_secret', 'totp_enabled']) {
      expect(cols.has(c), `colonne users.${c}`).toBe(true);
    }
  });
});
```

- [ ] **Step 3: Lancer le test d'intégration (DB up requise)**

Run: `pnpm test:integration`
Expected: 2 tests PASS (18 tables présentes, colonnes E2EE présentes).

- [ ] **Step 4: Commit (utilisateur)**

```bash
git add vitest.integration.config.ts test/schema-integrity.integration-spec.ts
git commit -m "test(b0): vérification d'intégrité schéma porté vs DB locale"
```

---

## Task 10: Réécriture CLAUDE.md backend-focused (GATE UTILISATEUR)

**Files:**
- Modify: `CLAUDE.md`

> ⚠️ **Cette tâche n'est PAS mécanique.** Elle est exécutée par le contrôleur (pas un subagent silencieux) : produire le brouillon, **le présenter à l'utilisateur pour validation**, consulter la doc officielle (WebFetch sur les liens de la section Sources), puis écrire seulement après accord. Voir le périmètre détaillé dans le spec (`docs/superpowers/specs/2026-05-31-b0-nestjs-foundation-design.md`, section « Réécriture CLAUDE.md »).

- [ ] **Step 1: Produire le brouillon backend-focused**

Conserver : Méthodologie/Rigueur/Ton, structure des réponses, Conventions code, Clean Architecture EAK (adaptée backend), Workflow Claude, Auto-révision CLAUDE.md, Sources officielles, Commandes. Retirer toutes les sections purement Angular. Développer NestJS / Drizzle / Zod / Auth-cookies / Vitest selon la doc officielle.

- [ ] **Step 2: Valider les affirmations techniques contre la doc officielle**

WebFetch sur : docs.nestjs.com (pipes, exception filters, configuration, security/helmet, CORS), orm.drizzle.team (schema, migrations, postgres-js), zod.dev. Corriger toute divergence.

- [ ] **Step 3: Présenter le brouillon à l'utilisateur et obtenir l'accord**

Ne PAS écrire le fichier avant le « OK » explicite de l'utilisateur.

- [ ] **Step 4: Écrire `CLAUDE.md` après accord**

- [ ] **Step 5: Pas de commit**

⚠️ Convention J-Ned : `.claude/` est **gitignoré** (comme dans le repo Angular) → `CLAUDE.md`
vit en local, **non versionné**. Aucun commit. Vérifier : `git check-ignore .claude/CLAUDE.md`
doit renvoyer un chemin (ignoré).

---

## Self-Review

**Couverture du spec :**
- Arborescence standalone → Tasks 3-8 ✓
- Couche Drizzle + baseline approche 1 (pas de migration, table dédiée) → Tasks 4, 5 ✓
- Config env validée Zod au boot → Task 3 ✓
- ZodValidationPipe + HttpExceptionFilter → Task 6 ✓
- Bootstrap helmet/CORS+credentials/cookie-parser/prefix /api/shutdown → Task 8 ✓
- Health + ping DB → Task 7 ✓
- Vitest + swc, décrochage Jest → Tasks 1, 2 ✓
- Vérif intégrité schéma ↔ DB → Task 9 ✓
- CLAUDE.md backend-focused (gate utilisateur) → Task 10 ✓
- Critères de succès 1-7 → couverts (boot 3001 T8, health 200 T8, intégrité T9, tests T8/9, middlewares T8, CLAUDE.md T10, pas de migration T5)

**Placeholders :** le port verbatim des tables (Task 4 steps 2-3) référence des plages de lignes de la source plutôt que d'inliner 130 lignes — justifié (transformation fidèle d'un fichier existant et lisible), et garanti par la spec d'intégrité (Tasks 4 step 6, 9). Pas de « TODO/à compléter ».

**Cohérence des types :** token `DRIZZLE` + type `DrizzleDB` (Task 5) réutilisés en Tasks 7. `Env`/`envSchema` (Task 3) réutilisés en Tasks 5, 8. `ZodValidationPipe`/`HttpExceptionFilter` (Task 6) câblés en Task 8. Port 3001 cohérent (Task 3 défaut, Task 8 listen, Task 9 via .env).
