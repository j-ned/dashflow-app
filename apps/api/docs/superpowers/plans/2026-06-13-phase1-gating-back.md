# Phase 1 — Gating back (FeatureGuard + limites) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.
>
> **J-Ned override :** ne JAMAIS exécuter `git commit`/`git add`. Les « Commit » sont des messages suggérés ; l'utilisateur committe.

**Goal:** Faire du back l'autorité du gating : un `FeatureGuard` qui refuse (403) les endpoints d'un domaine non couvert par le plan, et des contrôles de quota (402 `LIMIT_REACHED`) sur la création de comptes bancaires et de membres.

**Architecture:** Un décorateur `@RequiresFeature(...)` pose des metadata lues par `FeatureGuard`, qui résout l'entitlement via `EntitlementService` (Phase 0) et compare aux `features` du plan. Les limites numériques sont vérifiées dans les services de création via `EntitlementLimitsService.assertWithinLimit`. `EntitlementsModule` devient `@Global` pour exposer guard + services partout sans réimport.

**Tech Stack:** NestJS (Guards, Reflector, SetMetadata, HttpException), Drizzle, Vitest, pnpm.

**Pré-requis:** Phase 0 mergée/présente sur la branche `feat/monetisation-phase0` : `EntitlementService.getForUser`, `plan-catalog.ts` (`Feature`), `entitlement.resolver.ts`. On continue sur la **même branche**.

---

## Décisions de cadrage (lues du code, à respecter)

- **Footgun guard + héritage :** les controllers qui `extends OwnedCrudController` héritent de `@UseGuards(JwtAuthGuard)` posé sur la **classe de base**. Redéclarer `@UseGuards(FeatureGuard)` sur la classe dérivée **écrase** (shadow) la metadata de base → l'auth saute. **Donc sur ces controllers, toujours `@UseGuards(JwtAuthGuard, FeatureGuard)` ensemble.** Sur les controllers « propres » (non hérités) qui ont déjà `@UseGuards(JwtAuthGuard)`, on remplace par `@UseGuards(JwtAuthGuard, FeatureGuard)`.
- **`medical/calendar` est EXCLU du gating** : c'est un flux iCal **public par token, sans `JwtAuthGuard`** — aucun utilisateur en contexte. Ne pas y toucher.
- **`documents`** : `patientId` est obligatoire (document lié à un patient) → intrinsèquement médical. Gaté sous `storage.documents` (plan `family_health`). **Le quota d'octets `storageBytes` n'est PAS implémenté en Phase 1** (table `documents` sans colonne taille → nécessiterait une migration). Le gate de capacité suffit à bloquer solo/family.
- **RÉSOLU (2026-06-13)** : décision produit = **documents = `family_health` uniquement** (les documents sont liés à un patient, donc médicaux). La grille est corrigée (Famille : pas de stockage documents) et `family.limits.storageBytes` est passé à `0`. Le gate `storage.documents` posé sur le controller `documents` est donc correct tel quel ; aucune migration (option « patientId nullable » écartée).

### Cartographie features → controllers

| Feature | Controllers | Pattern |
|---|---|---|
| `medical.access` | `appointments`, `medications`, `patients`, `practitioners`, `prescriptions`, `reminders` | OwnedCrud → `@UseGuards(JwtAuthGuard, FeatureGuard)` |
| `medical.access` | `consumables` | propre → remplacer par `@UseGuards(JwtAuthGuard, FeatureGuard)` |
| `storage.documents` | `documents` | OwnedCrud → `@UseGuards(JwtAuthGuard, FeatureGuard)` |
| `budget.advanced` | `envelopes`, `loans`, `salary-archives`, `recurring-entries` | OwnedCrud → `@UseGuards(JwtAuthGuard, FeatureGuard)` |
| `family.sharing` | `shared-access` | propre → remplacer par `@UseGuards(JwtAuthGuard, FeatureGuard)` |
| `budget.import` | `account-transactions` → méthode `createBatch` uniquement | **méthode-level** `@UseGuards(FeatureGuard)` (Jwt reste classe-level) |

| Limite | Service | Clé |
|---|---|---|
| comptes bancaires | `BankAccountsService.create` | `bankAccounts` |
| membres | `MembersService.create` | `members` |

---

## File Structure

- `src/modules/entitlements/requires-feature.decorator.ts` — *créé* : `REQUIRES_FEATURE` + `RequiresFeature(...)`.
- `src/modules/entitlements/feature.guard.ts` — *créé* + `.spec.ts`.
- `src/modules/entitlements/limit-exceeded.exception.ts` — *créé* : 402 `LIMIT_REACHED`.
- `src/modules/entitlements/entitlement-limits.service.ts` — *créé* + `.spec.ts`.
- `src/modules/entitlements/entitlements.module.ts` — *modifié* : `@Global`, providers/exports guard+limits.
- 11 `*.controller.ts` médical/budget/partage — *modifiés* : décorateurs de gating.
- `src/modules/account-transactions/account-transactions.controller.ts` — *modifié* : gate méthode `createBatch`.
- `src/modules/bank-accounts/bank-accounts.service.ts` — *modifié* : limite + `.spec.ts` *créé*.
- `src/modules/members/members.service.ts` — *modifié* : limite + `.spec.ts` *créé*.

---

## Task 1: `@RequiresFeature` + `FeatureGuard` + EntitlementsModule @Global

**Files:**
- Create: `src/modules/entitlements/requires-feature.decorator.ts`
- Create: `src/modules/entitlements/feature.guard.ts`
- Test: `src/modules/entitlements/feature.guard.spec.ts`
- Modify: `src/modules/entitlements/entitlements.module.ts`

- [ ] **Step 1: Décorateur**

`src/modules/entitlements/requires-feature.decorator.ts` :
```ts
import { SetMetadata } from '@nestjs/common';
import type { Feature } from './plan-catalog';

export const REQUIRES_FEATURE = 'requires_feature';

/** Marque un controller/handler comme exigeant une ou plusieurs capacités du plan. */
export const RequiresFeature = (...features: Feature[]) => SetMetadata(REQUIRES_FEATURE, features);
```

- [ ] **Step 2: Test du guard (écris-le, vérifie l'échec)**

`src/modules/entitlements/feature.guard.spec.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureGuard } from './feature.guard';
import type { EntitlementService } from './entitlement.service';
import type { Feature } from './plan-catalog';

function ctx(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function reflectorReturning(features: Feature[] | undefined): Reflector {
  return { getAllAndOverride: () => features } as unknown as Reflector;
}

function entitlementsWith(features: Feature[]): EntitlementService {
  return {
    getForUser: async () => ({ planKey: 'family', features, limits: { bankAccounts: null, members: null, storageBytes: 0 } }),
  } as unknown as EntitlementService;
}

describe('FeatureGuard', () => {
  it('laisse passer si aucune feature requise', async () => {
    const guard = new FeatureGuard(reflectorReturning(undefined), entitlementsWith([]));
    await expect(guard.canActivate(ctx({ id: 'u1' }))).resolves.toBe(true);
  });

  it('laisse passer si le plan possède la feature', async () => {
    const guard = new FeatureGuard(reflectorReturning(['medical.access']), entitlementsWith(['medical.access']));
    await expect(guard.canActivate(ctx({ id: 'u1' }))).resolves.toBe(true);
  });

  it('refuse (403) si la feature manque', async () => {
    const guard = new FeatureGuard(reflectorReturning(['medical.access']), entitlementsWith(['budget.core']));
    await expect(guard.canActivate(ctx({ id: 'u1' }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuse (401) si pas d’utilisateur en contexte', async () => {
    const guard = new FeatureGuard(reflectorReturning(['medical.access']), entitlementsWith(['medical.access']));
    await expect(guard.canActivate(ctx(undefined))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
```
Run: `pnpm test feature.guard` → FAIL (`Cannot find module './feature.guard'`).

- [ ] **Step 3: Guard**

`src/modules/entitlements/feature.guard.ts` :
```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EntitlementService } from './entitlement.service';
import { REQUIRES_FEATURE } from './requires-feature.decorator';
import type { Feature } from './plan-catalog';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Feature[] | undefined>(REQUIRES_FEATURE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user?: { id?: string } }>();
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Non authentifié');

    const entitlement = await this.entitlements.getForUser(userId);
    const allowed = required.every((feature) => entitlement.features.includes(feature));
    if (!allowed) throw new ForbiddenException('Plan insuffisant pour cette fonctionnalité');
    return true;
  }
}
```
Run: `pnpm test feature.guard` → PASS (4 tests).

- [ ] **Step 4: EntitlementsModule @Global + enregistrement du guard**

Remplacer le contenu de `src/modules/entitlements/entitlements.module.ts` par :
```ts
import { Global, Module } from '@nestjs/common';
import { MeEntitlementsController } from './me-entitlements.controller';
import { EntitlementService } from './entitlement.service';
import { SubscriptionRepository } from './subscription.repository';
import { FeatureGuard } from './feature.guard';

@Global()
@Module({
  controllers: [MeEntitlementsController],
  providers: [EntitlementService, SubscriptionRepository, FeatureGuard],
  exports: [EntitlementService, FeatureGuard],
})
export class EntitlementsModule {}
```
(`Reflector` est fourni globalement par NestJS — pas besoin de le déclarer.)

- [ ] **Step 5: Build + suite**

Run: `pnpm build && pnpm test`
Expected: build OK ; suite complète verte (les 95 de Phase 0 + 4 nouveaux).

- [ ] **Step 6: Commit (suggéré)**

```
feat(entitlements): FeatureGuard + @RequiresFeature + module global
```

---

## Task 2: Limites — `LimitExceededException` (402) + `EntitlementLimitsService`

**Files:**
- Create: `src/modules/entitlements/limit-exceeded.exception.ts`
- Create: `src/modules/entitlements/entitlement-limits.service.ts`
- Test: `src/modules/entitlements/entitlement-limits.service.spec.ts`
- Modify: `src/modules/entitlements/entitlements.module.ts`

- [ ] **Step 1: Exception 402**

`src/modules/entitlements/limit-exceeded.exception.ts` :
```ts
import { HttpException, HttpStatus } from '@nestjs/common';

export type LimitKey = 'bankAccounts' | 'members' | 'storageBytes';

/** 402 Payment Required : quota du plan atteint. Le front traduit `code` en paywall ciblé. */
export class LimitExceededException extends HttpException {
  constructor(limit: LimitKey, max: number) {
    super({ code: 'LIMIT_REACHED', limit, max, message: `Limite atteinte (${limit})` }, HttpStatus.PAYMENT_REQUIRED);
  }
}
```

- [ ] **Step 2: Test du service de limites (écris-le, vérifie l'échec)**

`src/modules/entitlements/entitlement-limits.service.spec.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { EntitlementLimitsService } from './entitlement-limits.service';
import { LimitExceededException } from './limit-exceeded.exception';
import type { EntitlementService } from './entitlement.service';
import type { PlanLimits } from './plan-catalog';

function svcWith(limits: PlanLimits): EntitlementLimitsService {
  const entitlements = {
    getForUser: async () => ({ planKey: 'solo', features: [], limits }),
  } as unknown as EntitlementService;
  return new EntitlementLimitsService(entitlements);
}

describe('EntitlementLimitsService.assertWithinLimit', () => {
  it('laisse passer sous la limite', async () => {
    const svc = svcWith({ bankAccounts: 1, members: 1, storageBytes: 0 });
    await expect(svc.assertWithinLimit('u1', 'bankAccounts', 0)).resolves.toBeUndefined();
  });

  it('refuse (402) quand le compte courant atteint la limite', async () => {
    const svc = svcWith({ bankAccounts: 1, members: 1, storageBytes: 0 });
    await expect(svc.assertWithinLimit('u1', 'bankAccounts', 1)).rejects.toBeInstanceOf(LimitExceededException);
  });

  it('limite null = illimité, laisse toujours passer', async () => {
    const svc = svcWith({ bankAccounts: null, members: null, storageBytes: 0 });
    await expect(svc.assertWithinLimit('u1', 'members', 9999)).resolves.toBeUndefined();
  });
});
```
Run: `pnpm test entitlement-limits` → FAIL (module introuvable).

- [ ] **Step 3: Service**

`src/modules/entitlements/entitlement-limits.service.ts` :
```ts
import { Injectable } from '@nestjs/common';
import { EntitlementService } from './entitlement.service';
import { LimitExceededException, type LimitKey } from './limit-exceeded.exception';

@Injectable()
export class EntitlementLimitsService {
  constructor(private readonly entitlements: EntitlementService) {}

  /** Lève 402 `LIMIT_REACHED` si `currentCount` atteint déjà la limite du plan. `null` = illimité. */
  async assertWithinLimit(userId: string, limit: LimitKey, currentCount: number): Promise<void> {
    const entitlement = await this.entitlements.getForUser(userId);
    const max = entitlement.limits[limit];
    if (max !== null && currentCount >= max) {
      throw new LimitExceededException(limit, max);
    }
  }
}
```
Run: `pnpm test entitlement-limits` → PASS (3 tests).

- [ ] **Step 4: Enregistrer dans EntitlementsModule**

Dans `src/modules/entitlements/entitlements.module.ts`, ajouter l'import et inscrire le service en provider **et** export :
```ts
import { EntitlementLimitsService } from './entitlement-limits.service';
```
`providers: [EntitlementService, SubscriptionRepository, FeatureGuard, EntitlementLimitsService]`
`exports: [EntitlementService, FeatureGuard, EntitlementLimitsService]`

- [ ] **Step 5: Build + suite**

Run: `pnpm build && pnpm test`
Expected: vert (95 + 4 + 3).

- [ ] **Step 6: Commit (suggéré)**

```
feat(entitlements): EntitlementLimitsService + LimitExceededException (402)
```

---

## Task 3: Gates `medical.access` + `storage.documents`

**Files (modifiés) :**
- OwnedCrud-derived : `appointments`, `medications`, `patients`, `practitioners`, `prescriptions`, `reminders`, `documents` controllers.
- Propre : `consumables` controller.

Pour **chaque** controller listé, l'édition est la même structure : importer le guard + le décorateur, et appliquer au niveau **classe**. **Ne touche à rien d'autre dans ces fichiers.**

- [ ] **Step 1: Controllers OwnedCrud médical (`medical.access`)**

Pour chacun de `src/modules/{appointments,medications,patients,practitioners,prescriptions,reminders}/*.controller.ts` :

1. Ajouter les imports (après les imports existants) :
```ts
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FeatureGuard } from '../entitlements/feature.guard';
import { RequiresFeature } from '../entitlements/requires-feature.decorator';
```
> ⚠️ Si `UseGuards` est déjà importé depuis `@nestjs/common` dans le fichier, **ne le ré-importe pas** — ajoute seulement les 3 autres lignes.

2. Juste au-dessus de la ligne `export class XxxController extends OwnedCrudController<...>`, ajouter les deux décorateurs (et garder le `@Controller('...')` existant) :
```ts
@RequiresFeature('medical.access')
@UseGuards(JwtAuthGuard, FeatureGuard)
@Controller('appointments')   // ← garder le path existant du fichier
export class AppointmentsController extends OwnedCrudController<unknown> {
```
(Adapter le nom de classe et le path à chaque fichier.)

- [ ] **Step 2: `consumables` (controller propre, `medical.access`)**

Dans `src/modules/consumables/consumables.controller.ts` :
- Ajouter les imports `FeatureGuard` + `RequiresFeature` (cf. chemins ci-dessus). `UseGuards` et `JwtAuthGuard` y sont déjà importés.
- Remplacer la ligne `@UseGuards(JwtAuthGuard)` au-dessus de `@Controller('consumables')` par :
```ts
@RequiresFeature('medical.access')
@UseGuards(JwtAuthGuard, FeatureGuard)
@Controller('consumables')
```

- [ ] **Step 3: `documents` (OwnedCrud, `storage.documents`)**

Dans `src/modules/documents/documents.controller.ts` :
- Ajouter les imports `FeatureGuard` + `RequiresFeature`. `UseGuards` et `JwtAuthGuard` y sont déjà importés.
- Au-dessus de `@Controller('documents')` / `export class DocumentsController extends OwnedCrudController<...>`, ajouter :
```ts
@RequiresFeature('storage.documents')
@UseGuards(JwtAuthGuard, FeatureGuard)
@Controller('documents')
```

- [ ] **Step 4: Build + suite**

Run: `pnpm build && pnpm test`
Expected: build OK, suite verte (aucun test existant ne casse — les controllers gardent leur comportement pour un user autorisé).

- [ ] **Step 5: Commit (suggéré)**

```
feat(gating): @RequiresFeature medical.access + storage.documents sur modules santé
```

---

## Task 4: Gates `budget.advanced` + `family.sharing` + `budget.import`

**Files (modifiés) :**
- OwnedCrud : `envelopes`, `loans`, `salary-archives`, `recurring-entries` controllers (`budget.advanced`).
- Propre : `shared-access` controller (`family.sharing`).
- `account-transactions` controller (`budget.import`, **méthode** `createBatch`).

- [ ] **Step 1: Controllers OwnedCrud budget avancé (`budget.advanced`)**

Pour chacun de `src/modules/{envelopes,loans,salary-archives,recurring-entries}/*.controller.ts` :
- Ajouter les imports `UseGuards` (si absent), `JwtAuthGuard`, `FeatureGuard`, `RequiresFeature` (mêmes chemins qu'en Task 3).
- Au-dessus de `@Controller('...')` / `export class XxxController extends OwnedCrudController<...>` :
```ts
@RequiresFeature('budget.advanced')
@UseGuards(JwtAuthGuard, FeatureGuard)
@Controller('envelopes')   // ← path existant du fichier
export class EnvelopesController extends OwnedCrudController<unknown> {
```

- [ ] **Step 2: `shared-access` (controller propre, `family.sharing`)**

Dans `src/modules/shared-access/shared-access.controller.ts` :
- Ajouter imports `FeatureGuard` + `RequiresFeature`. `UseGuards`/`JwtAuthGuard` déjà présents.
- Remplacer `@UseGuards(JwtAuthGuard)` au-dessus de `@Controller('shared-access')` par :
```ts
@RequiresFeature('family.sharing')
@UseGuards(JwtAuthGuard, FeatureGuard)
@Controller('shared-access')
```

- [ ] **Step 3: `account-transactions` → gate méthode `createBatch` (`budget.import`)**

Dans `src/modules/account-transactions/account-transactions.controller.ts` :
- Ajouter imports `FeatureGuard` + `RequiresFeature`. `UseGuards` et `JwtAuthGuard` déjà présents (`@UseGuards(JwtAuthGuard)` reste au niveau classe → l'auth s'applique partout).
- Sur la **méthode** `createBatch` uniquement, ajouter les décorateurs juste avant ceux déjà présents :
```ts
  @RequiresFeature('budget.import')
  @UseGuards(FeatureGuard)
  @UseGuards(CsrfGuard) @Post('bank-accounts/:accountId/transactions/batch') @HttpCode(201)
  async createBatch(
```
> Le `@UseGuards(JwtAuthGuard)` classe-level reste prioritaire (s'exécute avant), `req.user` est donc disponible quand `FeatureGuard` s'exécute. **Ne pas** ajouter `JwtAuthGuard` ici (pas de shadowing au niveau méthode — les guards classe + méthode s'additionnent).

- [ ] **Step 4: Build + suite**

Run: `pnpm build && pnpm test`
Expected: build OK, suite verte.

- [ ] **Step 5: Commit (suggéré)**

```
feat(gating): @RequiresFeature budget.advanced + family.sharing + budget.import
```

---

## Task 5: Limite `bankAccounts` dans `BankAccountsService`

**Files:**
- Modify: `src/modules/bank-accounts/bank-accounts.service.ts`
- Test: `src/modules/bank-accounts/bank-accounts.service.spec.ts`

État actuel du service :
```ts
@Injectable()
export class BankAccountsService extends OwnedCrudService<BankAccount> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) { super(db, bankAccounts); }
}
```

- [ ] **Step 1: Test (écris-le, vérifie l'échec)**

`src/modules/bank-accounts/bank-accounts.service.spec.ts` :
```ts
import { describe, it, expect, vi } from 'vitest';
import { BankAccountsService } from './bank-accounts.service';
import { LimitExceededException } from '../entitlements/limit-exceeded.exception';
import type { DrizzleDB } from '../../db/drizzle.constants';
import type { EntitlementLimitsService } from '../entitlements/entitlement-limits.service';

// db factice : select().from().where() → renvoie [{ value: <count> }]
function dbWithCount(currentCount: number): DrizzleDB {
  return {
    select: () => ({ from: () => ({ where: async () => [{ value: currentCount }] }) }),
    insert: () => ({ values: () => ({ returning: async () => [{ id: 'new' }] }) }),
  } as unknown as DrizzleDB;
}

describe('BankAccountsService.create — limite', () => {
  it('crée si sous la limite', async () => {
    const limits = { assertWithinLimit: vi.fn().mockResolvedValue(undefined) } as unknown as EntitlementLimitsService;
    const svc = new BankAccountsService(dbWithCount(0), limits);
    const row = await svc.create('u1', { name: 'A' });
    expect(limits.assertWithinLimit).toHaveBeenCalledWith('u1', 'bankAccounts', 0);
    expect(row).toEqual({ id: 'new' });
  });

  it('propage le 402 si la limite est atteinte', async () => {
    const limits = {
      assertWithinLimit: vi.fn().mockRejectedValue(new LimitExceededException('bankAccounts', 1)),
    } as unknown as EntitlementLimitsService;
    const svc = new BankAccountsService(dbWithCount(1), limits);
    await expect(svc.create('u1', { name: 'B' })).rejects.toBeInstanceOf(LimitExceededException);
  });
});
```
Run: `pnpm test bank-accounts.service` → FAIL (le constructeur n'accepte pas encore `limits` / `create` non surchargé).

- [ ] **Step 2: Implémentation**

Remplacer le contenu de `src/modules/bank-accounts/bank-accounts.service.ts` par :
```ts
import { Inject, Injectable } from '@nestjs/common';
import { count, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { bankAccounts } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';
import { EntitlementLimitsService } from '../entitlements/entitlement-limits.service';

type BankAccount = typeof bankAccounts.$inferSelect;

@Injectable()
export class BankAccountsService extends OwnedCrudService<BankAccount> {
  constructor(
    @Inject(DRIZZLE) private readonly database: DrizzleDB,
    private readonly limits: EntitlementLimitsService,
  ) {
    super(database, bankAccounts);
  }

  override async create(userId: string, values: Record<string, unknown>): Promise<BankAccount> {
    const [{ value: current }] = await this.database
      .select({ value: count() })
      .from(bankAccounts)
      .where(eq(bankAccounts.userId, userId));
    await this.limits.assertWithinLimit(userId, 'bankAccounts', Number(current));
    return super.create(userId, values);
  }
}
```
> `EntitlementsModule` étant `@Global`, `EntitlementLimitsService` est injectable sans modifier `BankAccountsModule`.

Run: `pnpm test bank-accounts.service` → PASS (2 tests).

- [ ] **Step 3: Build + suite**

Run: `pnpm build && pnpm test`
Expected: vert.

- [ ] **Step 4: Commit (suggéré)**

```
feat(gating): limite bankAccounts (402) à la création de compte
```

---

## Task 6: Limite `members` dans `MembersService`

**Files:**
- Modify: `src/modules/members/members.service.ts`
- Test: `src/modules/members/members.service.spec.ts`

- [ ] **Step 1: Lire l'état actuel du service**

Ouvre `src/modules/members/members.service.ts` pour repérer sa forme (extends `OwnedCrudService` ou non, signature du constructeur, table `members`). **Si la structure diffère trop du modèle ci-dessous (ex. `create` déjà surchargé pour l'E2EE), arrête-toi et signale-le** plutôt que d'écraser de la logique.

- [ ] **Step 2: Test (écris-le, vérifie l'échec)**

`src/modules/members/members.service.spec.ts` :
```ts
import { describe, it, expect, vi } from 'vitest';
import { MembersService } from './members.service';
import { LimitExceededException } from '../entitlements/limit-exceeded.exception';
import type { DrizzleDB } from '../../db/drizzle.constants';
import type { EntitlementLimitsService } from '../entitlements/entitlement-limits.service';

function dbWithCount(currentCount: number): DrizzleDB {
  return {
    select: () => ({ from: () => ({ where: async () => [{ value: currentCount }] }) }),
    insert: () => ({ values: () => ({ returning: async () => [{ id: 'new' }] }) }),
  } as unknown as DrizzleDB;
}

describe('MembersService.create — limite', () => {
  it('crée si sous la limite', async () => {
    const limits = { assertWithinLimit: vi.fn().mockResolvedValue(undefined) } as unknown as EntitlementLimitsService;
    const svc = new MembersService(dbWithCount(0), limits);
    const row = await svc.create('u1', { firstName: 'A' });
    expect(limits.assertWithinLimit).toHaveBeenCalledWith('u1', 'members', 0);
    expect(row).toEqual({ id: 'new' });
  });

  it('propage le 402 si la limite est atteinte', async () => {
    const limits = {
      assertWithinLimit: vi.fn().mockRejectedValue(new LimitExceededException('members', 1)),
    } as unknown as EntitlementLimitsService;
    const svc = new MembersService(dbWithCount(1), limits);
    await expect(svc.create('u1', { firstName: 'B' })).rejects.toBeInstanceOf(LimitExceededException);
  });
});
```
Run: `pnpm test members.service` → FAIL.

- [ ] **Step 3: Implémentation**

Adapter `src/modules/members/members.service.ts` sur le modèle (en conservant tout comportement métier existant éventuel ; ajouter l'injection `EntitlementLimitsService` et surcharger `create`) :
```ts
import { Inject, Injectable } from '@nestjs/common';
import { count, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { members } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';
import { EntitlementLimitsService } from '../entitlements/entitlement-limits.service';

type Member = typeof members.$inferSelect;

@Injectable()
export class MembersService extends OwnedCrudService<Member> {
  constructor(
    @Inject(DRIZZLE) private readonly database: DrizzleDB,
    private readonly limits: EntitlementLimitsService,
  ) {
    super(database, members);
  }

  override async create(userId: string, values: Record<string, unknown>): Promise<Member> {
    const [{ value: current }] = await this.database
      .select({ value: count() })
      .from(members)
      .where(eq(members.userId, userId));
    await this.limits.assertWithinLimit(userId, 'members', Number(current));
    return super.create(userId, values);
  }
}
```
> Si le service existant importe `members` sous un autre nom ou expose des méthodes additionnelles (couleur, E2EE), **les préserver** : n'ajoute que l'injection + l'override `create`.

Run: `pnpm test members.service` → PASS (2 tests).

- [ ] **Step 4: Build + suite complète**

Run: `pnpm build && pnpm test`
Expected: build OK, **toute** la suite verte.

- [ ] **Step 5: Commit (suggéré)**

```
feat(gating): limite members (402) à la création de membre
```

---

## Definition of Done (Phase 1)

- [ ] `pnpm build` OK, `pnpm test` : suite complète verte (95 Phase 0 + ~11 nouveaux).
- [ ] `FeatureGuard` unitairement testé (allow/allow/403/401).
- [ ] `EntitlementLimitsService` testé (under/at/null).
- [ ] Gates posés : medical.access (7 controllers), storage.documents (documents), budget.advanced (4), family.sharing (shared-access), budget.import (batch).
- [ ] `medical/calendar` **non** gaté (flux public vérifié).
- [ ] Limites 402 sur `bankAccounts` et `members` à la création.
- [ ] `pnpm exec knip` ne signale pas les nouveaux fichiers comme inutilisés.

## Smoke runtime (optionnel, hors tests)

Avec la DB dev up + un user `solo` (sans souscription) : `GET /api/appointments` doit renvoyer **403**, `POST /api/bank-accounts` (2ᵉ compte) **402** `LIMIT_REACHED`. Le compte démo (`family_health`) doit, lui, tout passer. Si le smoke est bloqué par l'environnement, le signaler et avancer — les tests unitaires couvrent la logique.

## Notes de passage à la Phase 2 (front)

- Le front lira `GET /me/entitlements` et devra gérer **403** (route paywall) et **402 `code: LIMIT_REACHED`** (toast + paywall ciblé) dans l'interceptor.
- Décision produit ouverte (stockage Famille vs documents médicaux) à trancher avant la page pricing (Phase 3).
