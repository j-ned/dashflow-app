# Phase 0 — Socle entitlements (back) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **J-Ned override :** ne JAMAIS exécuter `git commit`/`git add`. Les étapes « Commit » sont remplacées par un message de commit suggéré ; l'utilisateur committe lui-même.

**Goal:** Poser la couche d'entitlements côté back (NestJS/Drizzle) : rôle admin, table `subscriptions`, table `stripe_events`, catalogue des plans en code, résolution de l'entitlement effectif avec dégradation vers `solo`, et endpoint `GET /me/entitlements`. Aucune UI, aucun Stripe encore.

**Architecture:** Le catalogue (`plan-catalog.ts`) est de la data pure. Une fonction pure `resolveEntitlement(snapshot, now)` calcule l'entitlement effectif (testable sans DB). Une `SubscriptionRepository` isole la requête Drizzle (testabilité). `EntitlementService` assemble repo + resolver. Un controller expose `GET /me/entitlements` derrière `JwtAuthGuard`.

**Tech Stack:** NestJS, Drizzle ORM (postgres-js), Zod, Vitest, pnpm. Spec source : `docs/superpowers/specs/2026-06-13-monetisation-pricing-design.md`.

---

## File Structure

- `src/db/schema/auth.ts` — *modifié* : ajoute `role` à `users`.
- `src/db/schema/billing.ts` — *créé* : tables `subscriptions` + `stripeEvents`.
- `src/db/schema/index.ts` — *modifié* : re-export `billing`.
- `src/db/migrations/*` — *généré* : migration SQL (additions only).
- `src/modules/entitlements/plan-catalog.ts` — *créé* : types `PlanKey`/`Feature`/`PlanLimits`, `PLAN_CATALOG`.
- `src/modules/entitlements/plan-catalog.spec.ts` — *créé*.
- `src/modules/entitlements/entitlement.resolver.ts` — *créé* : types `SubscriptionSnapshot`/`ResolvedEntitlement`, `resolveEntitlement()`.
- `src/modules/entitlements/entitlement.resolver.spec.ts` — *créé*.
- `src/modules/entitlements/subscription.repository.ts` — *créé* : `findByUserId()`.
- `src/modules/entitlements/entitlement.service.ts` — *créé* : `getForUser()`.
- `src/modules/entitlements/entitlement.service.spec.ts` — *créé*.
- `src/modules/entitlements/me-entitlements.controller.ts` — *créé* : `GET /me/entitlements`.
- `src/modules/entitlements/me-entitlements.controller.spec.ts` — *créé*.
- `src/modules/entitlements/entitlements.module.ts` — *créé*.
- `src/app.module.ts` — *modifié* : importe `EntitlementsModule`.
- `scripts/db/seed-entitlements.mjs` — *créé* : owner→admin, démo→`family_health` (admin).

**Convention test :** `pnpm test <pattern>` lance `vitest run` filtré. Suite complète : `pnpm test`. Build : `pnpm build`.

---

## Task 1: Schéma — `role`, `subscriptions`, `stripe_events`

**Files:**
- Modify: `src/db/schema/auth.ts`
- Create: `src/db/schema/billing.ts`
- Modify: `src/db/schema/index.ts`

- [ ] **Step 1: Ajouter `role` à la table `users`**

Dans `src/db/schema/auth.ts`, ajouter le champ `role` juste après `isDemoAccount` :

```ts
  isDemoAccount: boolean('is_demo_account').notNull().default(false),
  role: varchar('role', { length: 16 }).notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
```

(`varchar` est déjà importé dans ce fichier — pas de nouvel import.)

- [ ] **Step 2: Créer `src/db/schema/billing.ts`**

```ts
import { pgTable, uuid, varchar, timestamp, boolean } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  planKey: varchar('plan_key', { length: 32 }).notNull(),
  status: varchar('status', { length: 32 }).notNull(),
  source: varchar('source', { length: 16 }).notNull(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const stripeEvents = pgTable('stripe_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: varchar('event_id', { length: 255 }).notNull().unique(),
  type: varchar('type', { length: 128 }).notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 3: Re-exporter `billing` depuis l'index**

Dans `src/db/schema/index.ts`, ajouter la ligne :

```ts
export * from './billing';
```

- [ ] **Step 4: Générer la migration**

Run: `pnpm db:generate`
Expected: un nouveau fichier `src/db/migrations/XXXX_*.sql` est créé, contenant `ALTER TABLE "users" ADD COLUMN "role" varchar(16) NOT NULL DEFAULT 'user'`, `CREATE TABLE "subscriptions"`, `CREATE TABLE "stripe_events"`. Aucune destruction (additions only). Commande non interactive.

- [ ] **Step 5: Appliquer la migration sur la DB de dev**

Run: `pnpm db:migrate`
Expected: `Migrations à jour.`

- [ ] **Step 6: Vérifier que le build passe (types schéma)**

Run: `pnpm build`
Expected: build OK, pas d'erreur TS.

- [ ] **Step 7: Commit (suggéré — l'utilisateur committe)**

Message :
```
feat(billing): schéma role + subscriptions + stripe_events
```

---

## Task 2: Catalogue des plans (`plan-catalog.ts`)

**Files:**
- Create: `src/modules/entitlements/plan-catalog.ts`
- Test: `src/modules/entitlements/plan-catalog.spec.ts`

- [ ] **Step 1: Écrire le test qui échoue**

`src/modules/entitlements/plan-catalog.spec.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { PLAN_CATALOG, type PlanKey } from './plan-catalog';

describe('PLAN_CATALOG', () => {
  it('expose exactement les 3 plans', () => {
    expect(Object.keys(PLAN_CATALOG).sort()).toEqual(['family', 'family_health', 'solo']);
  });

  it('solo est limité : budget.core seul, 1 compte, 1 membre, 0 stockage', () => {
    const solo = PLAN_CATALOG.solo;
    expect(solo.features).toEqual(['budget.core']);
    expect(solo.limits).toEqual({ bankAccounts: 1, members: 1, storageBytes: 0 });
    expect(solo.stripePriceEnv).toBeUndefined();
  });

  it('family débloque budget avancé, import, partage, prévisions, comptes/membres illimités', () => {
    const family = PLAN_CATALOG.family;
    expect(family.features).toContain('budget.advanced');
    expect(family.features).toContain('budget.import');
    expect(family.features).toContain('family.sharing');
    expect(family.features).toContain('analytics.forecast');
    expect(family.features).not.toContain('medical.access');
    expect(family.limits.bankAccounts).toBeNull();
    expect(family.limits.members).toBeNull();
    expect(family.stripePriceEnv).toBe('STRIPE_PRICE_FAMILY');
  });

  it('family_health est un sur-ensemble strict de family + médical + stockage documents', () => {
    const family = PLAN_CATALOG.family;
    const fh = PLAN_CATALOG.family_health;
    for (const f of family.features) expect(fh.features).toContain(f);
    expect(fh.features).toContain('medical.access');
    expect(fh.features).toContain('storage.documents');
    expect(fh.limits.storageBytes).toBeGreaterThan(family.limits.storageBytes);
    expect(fh.stripePriceEnv).toBe('STRIPE_PRICE_FAMILY_HEALTH');
  });

  it('aucune limite numérique négative', () => {
    for (const key of Object.keys(PLAN_CATALOG) as PlanKey[]) {
      expect(PLAN_CATALOG[key].limits.storageBytes).toBeGreaterThanOrEqual(0);
    }
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `pnpm test plan-catalog`
Expected: FAIL — `Cannot find module './plan-catalog'`.

- [ ] **Step 3: Implémenter le catalogue**

`src/modules/entitlements/plan-catalog.ts` :

```ts
export type PlanKey = 'solo' | 'family' | 'family_health';

export type Feature =
  | 'budget.core'
  | 'budget.advanced'
  | 'budget.import'
  | 'family.sharing'
  | 'analytics.forecast'
  | 'medical.access'
  | 'storage.documents';

export interface PlanLimits {
  /** `null` = illimité. */
  bankAccounts: number | null;
  members: number | null;
  storageBytes: number;
}

export interface PlanDefinition {
  key: PlanKey;
  features: Feature[];
  limits: PlanLimits;
  stripePriceEnv?: 'STRIPE_PRICE_FAMILY' | 'STRIPE_PRICE_FAMILY_HEALTH';
}

const GIGA = 1024 ** 3;

const FAMILY_FEATURES: Feature[] = [
  'budget.core',
  'budget.advanced',
  'budget.import',
  'family.sharing',
  'analytics.forecast',
];

export const PLAN_CATALOG: Record<PlanKey, PlanDefinition> = {
  solo: {
    key: 'solo',
    features: ['budget.core'],
    limits: { bankAccounts: 1, members: 1, storageBytes: 0 },
  },
  family: {
    key: 'family',
    features: [...FAMILY_FEATURES],
    limits: { bankAccounts: null, members: null, storageBytes: GIGA },
    stripePriceEnv: 'STRIPE_PRICE_FAMILY',
  },
  family_health: {
    key: 'family_health',
    features: [...FAMILY_FEATURES, 'medical.access', 'storage.documents'],
    limits: { bankAccounts: null, members: null, storageBytes: 10 * GIGA },
    stripePriceEnv: 'STRIPE_PRICE_FAMILY_HEALTH',
  },
};
```

- [ ] **Step 4: Lancer le test pour le voir passer**

Run: `pnpm test plan-catalog`
Expected: PASS (5 tests verts).

- [ ] **Step 5: Commit (suggéré)**

```
feat(entitlements): catalogue des 3 plans (data + types)
```

---

## Task 3: Résolution de l'entitlement (`entitlement.resolver.ts`)

**Files:**
- Create: `src/modules/entitlements/entitlement.resolver.ts`
- Test: `src/modules/entitlements/entitlement.resolver.spec.ts`

- [ ] **Step 1: Écrire le test qui échoue**

`src/modules/entitlements/entitlement.resolver.spec.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { resolveEntitlement, type SubscriptionSnapshot } from './entitlement.resolver';

const NOW = new Date('2026-06-13T00:00:00.000Z');
const FUTURE = new Date('2026-07-13T00:00:00.000Z');
const PAST = new Date('2026-05-13T00:00:00.000Z');

function snap(overrides: Partial<SubscriptionSnapshot> = {}): SubscriptionSnapshot {
  return {
    planKey: 'family',
    status: 'active',
    source: 'stripe',
    currentPeriodEnd: FUTURE,
    ...overrides,
  };
}

describe('resolveEntitlement', () => {
  it('aucune souscription → solo', () => {
    const e = resolveEntitlement(null, NOW);
    expect(e.planKey).toBe('solo');
    expect(e.features).toEqual(['budget.core']);
  });

  it('stripe active non expirée → le plan', () => {
    expect(resolveEntitlement(snap({ planKey: 'family_health' }), NOW).planKey).toBe('family_health');
  });

  it('stripe trialing → le plan', () => {
    expect(resolveEntitlement(snap({ status: 'trialing' }), NOW).planKey).toBe('family');
  });

  it('canceled → dégrade vers solo', () => {
    expect(resolveEntitlement(snap({ status: 'canceled' }), NOW).planKey).toBe('solo');
  });

  it('past_due → dégrade vers solo', () => {
    expect(resolveEntitlement(snap({ status: 'past_due' }), NOW).planKey).toBe('solo');
  });

  it('active mais période expirée → dégrade vers solo', () => {
    expect(resolveEntitlement(snap({ currentPeriodEnd: PAST }), NOW).planKey).toBe('solo');
  });

  it('source admin → applique le plan même si status non actif (override SAV)', () => {
    const e = resolveEntitlement(snap({ source: 'admin', status: 'canceled', planKey: 'family_health', currentPeriodEnd: PAST }), NOW);
    expect(e.planKey).toBe('family_health');
    expect(e.features).toContain('medical.access');
  });

  it('retourne des copies (pas de mutation du catalogue)', () => {
    const e = resolveEntitlement(snap(), NOW);
    e.features.push('medical.access');
    const again = resolveEntitlement(snap(), NOW);
    expect(again.features).not.toContain('medical.access');
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `pnpm test entitlement.resolver`
Expected: FAIL — `Cannot find module './entitlement.resolver'`.

- [ ] **Step 3: Implémenter le resolver**

`src/modules/entitlements/entitlement.resolver.ts` :

```ts
import { PLAN_CATALOG, type Feature, type PlanKey, type PlanLimits } from './plan-catalog';

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete';

export type EntitlementSource = 'free' | 'stripe' | 'admin';

export interface SubscriptionSnapshot {
  planKey: PlanKey;
  status: SubscriptionStatus;
  source: EntitlementSource;
  currentPeriodEnd: Date | null;
}

export interface ResolvedEntitlement {
  planKey: PlanKey;
  features: Feature[];
  limits: PlanLimits;
}

const ACTIVE_STATUSES: readonly SubscriptionStatus[] = ['active', 'trialing'];

function toEntitlement(key: PlanKey): ResolvedEntitlement {
  const plan = PLAN_CATALOG[key];
  return { planKey: key, features: [...plan.features], limits: { ...plan.limits } };
}

/** Calcule l'entitlement effectif. Dégrade vers `solo` plutôt qu'une coupure brutale. */
export function resolveEntitlement(
  sub: SubscriptionSnapshot | null,
  now: Date,
): ResolvedEntitlement {
  if (!sub) return toEntitlement('solo');
  if (sub.source === 'admin') return toEntitlement(sub.planKey);

  const isActiveStatus = ACTIVE_STATUSES.includes(sub.status);
  const notExpired =
    sub.currentPeriodEnd === null || sub.currentPeriodEnd.getTime() > now.getTime();

  return isActiveStatus && notExpired ? toEntitlement(sub.planKey) : toEntitlement('solo');
}
```

- [ ] **Step 4: Lancer le test pour le voir passer**

Run: `pnpm test entitlement.resolver`
Expected: PASS (8 tests verts).

- [ ] **Step 5: Commit (suggéré)**

```
feat(entitlements): resolveEntitlement + dégradation vers solo
```

---

## Task 4: Repository de souscription (`subscription.repository.ts`)

**Files:**
- Create: `src/modules/entitlements/subscription.repository.ts`

Aucune logique métier → testé indirectement via le service (Task 5) et l'usage réel. La requête est isolée ici pour que le service reste mockable.

- [ ] **Step 1: Implémenter le repository**

`src/modules/entitlements/subscription.repository.ts` :

```ts
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { subscriptions } from '../../db/schema';

export type SubscriptionRow = typeof subscriptions.$inferSelect;

@Injectable()
export class SubscriptionRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByUserId(userId: string): Promise<SubscriptionRow | null> {
    const rows = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);
    return rows[0] ?? null;
  }
}
```

- [ ] **Step 2: Vérifier que le build passe**

Run: `pnpm build`
Expected: build OK.

- [ ] **Step 3: Commit (suggéré)**

```
feat(entitlements): SubscriptionRepository.findByUserId
```

---

## Task 5: Service d'entitlement (`entitlement.service.ts`)

**Files:**
- Create: `src/modules/entitlements/entitlement.service.ts`
- Test: `src/modules/entitlements/entitlement.service.spec.ts`

- [ ] **Step 1: Écrire le test qui échoue**

`src/modules/entitlements/entitlement.service.spec.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { EntitlementService } from './entitlement.service';
import type { SubscriptionRepository, SubscriptionRow } from './subscription.repository';

function makeRepo(row: SubscriptionRow | null): SubscriptionRepository {
  return { findByUserId: async () => row } as unknown as SubscriptionRepository;
}

function row(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    id: 'sub-1',
    userId: 'user-1',
    planKey: 'family',
    status: 'active',
    source: 'stripe',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodEnd: new Date('2999-01-01T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as SubscriptionRow;
}

describe('EntitlementService', () => {
  it('sans souscription → solo', async () => {
    const svc = new EntitlementService(makeRepo(null));
    const e = await svc.getForUser('user-1');
    expect(e.planKey).toBe('solo');
  });

  it('souscription family active → family', async () => {
    const svc = new EntitlementService(makeRepo(row({ planKey: 'family' })));
    const e = await svc.getForUser('user-1');
    expect(e.planKey).toBe('family');
    expect(e.features).toContain('budget.import');
  });

  it('souscription canceled → solo', async () => {
    const svc = new EntitlementService(makeRepo(row({ status: 'canceled' })));
    const e = await svc.getForUser('user-1');
    expect(e.planKey).toBe('solo');
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `pnpm test entitlement.service`
Expected: FAIL — `Cannot find module './entitlement.service'`.

- [ ] **Step 3: Implémenter le service**

`src/modules/entitlements/entitlement.service.ts` :

```ts
import { Injectable } from '@nestjs/common';
import { SubscriptionRepository, type SubscriptionRow } from './subscription.repository';
import {
  resolveEntitlement,
  type ResolvedEntitlement,
  type SubscriptionSnapshot,
  type SubscriptionStatus,
  type EntitlementSource,
} from './entitlement.resolver';
import type { PlanKey } from './plan-catalog';

function toSnapshot(row: SubscriptionRow | null): SubscriptionSnapshot | null {
  if (!row) return null;
  return {
    planKey: row.planKey as PlanKey,
    status: row.status as SubscriptionStatus,
    source: row.source as EntitlementSource,
    currentPeriodEnd: row.currentPeriodEnd,
  };
}

@Injectable()
export class EntitlementService {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  async getForUser(userId: string): Promise<ResolvedEntitlement> {
    const row = await this.subscriptions.findByUserId(userId);
    return resolveEntitlement(toSnapshot(row), new Date());
  }
}
```

- [ ] **Step 4: Lancer le test pour le voir passer**

Run: `pnpm test entitlement.service`
Expected: PASS (3 tests verts).

- [ ] **Step 5: Commit (suggéré)**

```
feat(entitlements): EntitlementService.getForUser
```

---

## Task 6: Endpoint `GET /me/entitlements` + module + wiring

**Files:**
- Create: `src/modules/entitlements/me-entitlements.controller.ts`
- Test: `src/modules/entitlements/me-entitlements.controller.spec.ts`
- Create: `src/modules/entitlements/entitlements.module.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Écrire le test du controller qui échoue**

`src/modules/entitlements/me-entitlements.controller.spec.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { MeEntitlementsController } from './me-entitlements.controller';
import type { EntitlementService } from './entitlement.service';
import type { ResolvedEntitlement } from './entitlement.resolver';

describe('MeEntitlementsController', () => {
  it('retourne l’entitlement résolu de l’utilisateur courant', async () => {
    const expected: ResolvedEntitlement = {
      planKey: 'family',
      features: ['budget.core'],
      limits: { bankAccounts: null, members: null, storageBytes: 0 },
    };
    let receivedUserId = '';
    const svc = {
      getForUser: async (userId: string) => {
        receivedUserId = userId;
        return expected;
      },
    } as unknown as EntitlementService;

    const controller = new MeEntitlementsController(svc);
    const result = await controller.me({ id: 'user-42', email: 'a@b.com' });

    expect(receivedUserId).toBe('user-42');
    expect(result).toEqual(expected);
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `pnpm test me-entitlements`
Expected: FAIL — `Cannot find module './me-entitlements.controller'`.

- [ ] **Step 3: Implémenter le controller**

`src/modules/entitlements/me-entitlements.controller.ts` :

```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { EntitlementService } from './entitlement.service';
import type { ResolvedEntitlement } from './entitlement.resolver';

@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeEntitlementsController {
  constructor(private readonly entitlements: EntitlementService) {}

  @Get('entitlements')
  me(@CurrentUser() user: AuthUser): Promise<ResolvedEntitlement> {
    return this.entitlements.getForUser(user.id);
  }
}
```

- [ ] **Step 4: Lancer le test pour le voir passer**

Run: `pnpm test me-entitlements`
Expected: PASS (1 test vert).

- [ ] **Step 5: Créer le module**

`src/modules/entitlements/entitlements.module.ts` :

```ts
import { Module } from '@nestjs/common';
import { MeEntitlementsController } from './me-entitlements.controller';
import { EntitlementService } from './entitlement.service';
import { SubscriptionRepository } from './subscription.repository';

@Module({
  controllers: [MeEntitlementsController],
  providers: [EntitlementService, SubscriptionRepository],
  exports: [EntitlementService],
})
export class EntitlementsModule {}
```

- [ ] **Step 6: Enregistrer le module dans `app.module.ts`**

Dans `src/app.module.ts`, ajouter l'import en tête (à côté des autres modules) :

```ts
import { EntitlementsModule } from './modules/entitlements/entitlements.module';
```

et l'ajouter au tableau `imports` du `@Module`, après `SharedAccessModule` (ou à la fin de la liste des modules métier) :

```ts
    SharedAccessModule,
    EntitlementsModule,
```

- [ ] **Step 7: Vérifier build + suite complète**

Run: `pnpm build && pnpm test`
Expected: build OK ; toute la suite verte (anciens tests + nouveaux).

- [ ] **Step 8: Commit (suggéré)**

```
feat(entitlements): endpoint GET /me/entitlements + module
```

---

## Task 7: Seed — owner admin + démo `family_health`

**Files:**
- Create: `scripts/db/seed-entitlements.mjs`

Script idempotent, exécuté à la main. Promeut un compte en `admin` (par email) et donne au compte démo un entitlement `family_health` (source `admin`).

> **« users existants → solo » est implicite** : un user sans ligne `subscriptions` est résolu en `solo` par `resolveEntitlement` (Task 3). On n'insère donc **aucune** ligne `solo` — pas de seed nécessaire pour ce cas, et aucun risque de désync.

- [ ] **Step 1: Écrire le script**

`scripts/db/seed-entitlements.mjs` :

```js
// Seed entitlements. Idempotent. Exécution manuelle.
//   pnpm exec node --env-file-if-exists=.env scripts/db/seed-entitlements.mjs OWNER_EMAIL=contact@nedellec-julien.fr
// - Promeut OWNER_EMAIL au rôle 'admin'.
// - Donne au compte démo (is_demo_account = true) une souscription family_health (source admin).
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquant.');
  process.exit(1);
}

const ownerArg = process.argv.find((a) => a.startsWith('OWNER_EMAIL='));
const ownerEmail = ownerArg ? ownerArg.split('=')[1] : process.env.OWNER_EMAIL;

const sql = postgres(url, { max: 1 });
try {
  if (ownerEmail) {
    const updated = await sql`
      UPDATE users SET role = 'admin' WHERE email = ${ownerEmail} RETURNING id`;
    console.log(updated.length ? `Owner ${ownerEmail} → admin.` : `Aucun user pour ${ownerEmail}.`);
  } else {
    console.log('OWNER_EMAIL non fourni → promotion admin ignorée.');
  }

  const demo = await sql`SELECT id FROM users WHERE is_demo_account = true LIMIT 1`;
  if (demo.length) {
    const demoId = demo[0].id;
    await sql`
      INSERT INTO subscriptions (user_id, plan_key, status, source)
      VALUES (${demoId}, 'family_health', 'active', 'admin')
      ON CONFLICT (user_id) DO UPDATE
        SET plan_key = 'family_health', status = 'active', source = 'admin', updated_at = now()`;
    console.log('Compte démo → family_health (admin).');
  } else {
    console.log('Aucun compte démo → seed démo ignoré.');
  }
} catch (err) {
  console.error('Échec du seed :', err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
```

- [ ] **Step 2: Exécuter le seed sur la DB de dev**

Run: `pnpm exec node --env-file-if-exists=.env scripts/db/seed-entitlements.mjs OWNER_EMAIL=contact@nedellec-julien.fr`
Expected: lignes de log « Owner … → admin. » et « Compte démo → family_health (admin). » (selon présence des comptes ; ré-exécutable sans erreur).

- [ ] **Step 3: Vérifier manuellement via l'endpoint (smoke optionnel)**

Avec un JWT du compte démo (cf. route demo-login), `GET /me/entitlements` doit renvoyer `planKey: "family_health"`. Si l'environnement bloque le smoke (rate-limit), signaler non-exécuté et avancer (les tests couvrent la logique).

- [ ] **Step 4: Commit (suggéré)**

```
feat(entitlements): seed owner admin + démo family_health
```

---

## Definition of Done (Phase 0)

- [ ] `pnpm build` OK.
- [ ] `pnpm test` : suite complète verte (catalogue, resolver, service, controller + suites existantes).
- [ ] Migration générée + appliquée (role + subscriptions + stripe_events), sans destruction.
- [ ] `GET /me/entitlements` répond avec `{ planKey, features, limits }`.
- [ ] Seed exécutable : owner → admin, démo → family_health.
- [ ] `pnpm exec knip` ne signale pas les nouveaux fichiers comme inutilisés (sinon, c'est qu'un wiring manque).

## Notes de passage à la Phase 1

- `EntitlementService.getForUser` est exporté par `EntitlementsModule` → directement injectable par le futur `FeatureGuard` (Phase 1).
- Le mapping `planKey → price_id` (via `stripePriceEnv`) est prêt pour Stripe (Phase 4) mais non encore branché : les variables d'env correspondantes seront ajoutées à `env.schema.ts` en Phase 4 uniquement.
