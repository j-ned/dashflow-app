# Phase 5 — Dashboard admin (back) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).
>
> **J-Ned override :** ne JAMAIS `git commit`/`git add`. Messages suggérés ; l'utilisateur committe.

**Goal:** Exposer les endpoints d'administration : `GET /admin/users` (états de paiement, filtrés/paginés), `GET /admin/metrics` (par plan + MRR), `PATCH /admin/users/:id/plan` (override SAV) — réservés au rôle `admin`. **E2EE préservé : uniquement des métadonnées de facturation, jamais de données déchiffrées.**

**Architecture:** Un `RolesGuard` + `@Roles('admin')` (le rôle est lu en base, le JWT ne le porte pas). Un `AdminRepository` joint `users` ⟕ `subscriptions` ; `AdminService` mappe chaque user vers son entitlement **effectif** via `resolveEntitlement` (Phase 0) et calcule les métriques. L'override réutilise `SubscriptionRepository.upsertByUserId` (Phase 4) avec `source: 'admin'`.

**Tech Stack:** NestJS (Guards, Reflector), Drizzle, Zod, Vitest, pnpm.

**Pré-requis (présents) :** `users.role` (Phase 0), `resolveEntitlement` + `SubscriptionSnapshot`/`SubscriptionStatus` (Phase 0), `SubscriptionRepository.upsertByUserId` exporté (Phase 4), `PLAN_CATALOG`/`PlanKey`, `JwtAuthGuard`, `CsrfGuard`, `@CurrentUser`, `parseBody`.

---

## Décisions de cadrage

- **Rôle lu en base** : le JWT ne contient que `{sub,email}`. `RolesGuard` injecte `DRIZZLE` (@Global) et lit `users.role` par `req.user.id`. (Pas de re-émission de token.)
- **E2EE** : la liste admin ne renvoie QUE : email, plan effectif, statut, source, fin de période, date d'inscription, démo, rôle. Aucun champ chiffré, aucune donnée budget/santé.
- **Plan effectif** = `resolveEntitlement(snapshot, now).planKey` (un canceled/expiré s'affiche dégradé en `solo`, cohérent avec le runtime).
- **MRR** = somme des prix mensuels des abonnements `source = 'stripe'` ET `status ∈ {active, trialing}`. Prix mensuels dans `admin/plan-pricing.ts` (donnée produit : solo 0, family 6.99, family_health 11.99).
- **Override** : `PATCH /admin/users/:id/plan { planKey }` → `upsertByUserId(id, { planKey, status:'active', source:'admin' })`. `planKey: 'solo'` = révocation (retour gratuit). Gardé par JWT + RolesGuard + CSRF.
- **Front (route `/admin` + table + adminGuard)** : cycle AAK Angular séparé (notes de clôture). Cette phase back ajoute aussi `role` à `toPublicUser` pour que le front puisse gater.

---

## File Structure

- `src/common/decorators/roles.decorator.ts` — *créé* : `ROLES_KEY` + `@Roles(...)`.
- `src/common/guards/roles.guard.ts` — *créé* + `.spec.ts` : refuse 403 si rôle insuffisant.
- `src/auth/auth.response.ts` — *modifié* : `toPublicUser` expose `role`.
- `src/modules/admin/plan-pricing.ts` — *créé* : `PLAN_MONTHLY_PRICE`.
- `src/modules/admin/admin.repository.ts` — *créé* : `listUsersWithSubscription`, `countAll`.
- `src/modules/admin/admin.service.ts` — *créé* + `.spec.ts` : mapping liste + métriques + override.
- `src/modules/admin/dto/admin.dto.ts` — *créé* : Zod `listQuerySchema`, `overridePlanSchema`.
- `src/modules/admin/admin.controller.ts` — *créé* + `.spec.ts` : 3 routes.
- `src/modules/admin/admin.module.ts` — *créé*.
- `src/app.module.ts` — *modifié* : importe `AdminModule`.

---

## Task 1: `@Roles` + `RolesGuard`

**Files:**
- Create: `src/common/decorators/roles.decorator.ts`, `src/common/guards/roles.guard.ts`
- Test: `src/common/guards/roles.guard.spec.ts`

- [ ] **Step 1: Décorateur**

`src/common/decorators/roles.decorator.ts` :
```ts
import { SetMetadata } from '@nestjs/common';

export type UserRole = 'user' | 'admin';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

- [ ] **Step 2: Test du guard (écris-le, vérifie l'échec)**

`src/common/guards/roles.guard.spec.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import type { DrizzleDB } from '../../db/drizzle.constants';

function ctx(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}
const reflector = (roles: string[] | undefined): Reflector =>
  ({ getAllAndOverride: () => roles }) as unknown as Reflector;
const db = (role: string | null): DrizzleDB =>
  ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => (role ? [{ role }] : []) }) }) }),
  }) as unknown as DrizzleDB;

describe('RolesGuard', () => {
  it('laisse passer si aucun rôle requis', async () => {
    const guard = new RolesGuard(reflector(undefined), db('user'));
    await expect(guard.canActivate(ctx({ id: 'u1' }))).resolves.toBe(true);
  });
  it('laisse passer un admin', async () => {
    const guard = new RolesGuard(reflector(['admin']), db('admin'));
    await expect(guard.canActivate(ctx({ id: 'u1' }))).resolves.toBe(true);
  });
  it('refuse (403) un user non admin', async () => {
    const guard = new RolesGuard(reflector(['admin']), db('user'));
    await expect(guard.canActivate(ctx({ id: 'u1' }))).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('refuse (401) sans utilisateur', async () => {
    const guard = new RolesGuard(reflector(['admin']), db('admin'));
    await expect(guard.canActivate(ctx(undefined))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
```
Run: `pnpm test roles.guard` → FAIL (module introuvable).

- [ ] **Step 3: Guard**

`src/common/guards/roles.guard.ts` :
```ts
import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { users } from '../../db/schema';
import { ROLES_KEY, type UserRole } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user?: { id?: string } }>();
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Non authentifié');

    const rows = await this.db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    const role = rows[0]?.role as UserRole | undefined;
    if (!role || !required.includes(role)) throw new ForbiddenException('Accès réservé');
    return true;
  }
}
```
Run: `pnpm test roles.guard` → PASS (4 tests).

- [ ] **Step 4: Build + suite**

Run: `pnpm build && pnpm test`
Expected: vert.

- [ ] **Step 5: Commit (suggéré)**

```
feat(admin): RolesGuard + @Roles (rôle lu en base)
```

---

## Task 2: Exposer `role` dans la réponse user

**Files:**
- Modify: `src/auth/auth.response.ts`

- [ ] **Step 1: Ajouter `role` à `toPublicUser`**

Dans `src/auth/auth.response.ts`, ajouter `role: u.role,` dans l'objet retourné par `toPublicUser` (après `isDemoAccount`) :
```ts
    isDemoAccount: u.isDemoAccount,
    role: u.role,
  };
```

- [ ] **Step 2: Build + suite**

Run: `pnpm build && pnpm test`
Expected: vert (si un spec d'auth fige la forme exacte de `toPublicUser`, ajouter `role` à l'attendu — sinon rien). Si un test casse à cause de cet ajout, l'ajuster en ajoutant `role` à l'objet attendu et le signaler.

- [ ] **Step 3: Commit (suggéré)**

```
feat(admin): expose role dans la réponse user (gating front)
```

---

## Task 3: `PLAN_MONTHLY_PRICE` + `AdminRepository`

**Files:**
- Create: `src/modules/admin/plan-pricing.ts`, `src/modules/admin/admin.repository.ts`

- [ ] **Step 1: Prix mensuels**

`src/modules/admin/plan-pricing.ts` :
```ts
import type { PlanKey } from '../entitlements/plan-catalog';

/** Prix mensuels affichés (EUR) — sert au calcul du MRR estimé. */
export const PLAN_MONTHLY_PRICE: Record<PlanKey, number> = {
  solo: 0,
  family: 6.99,
  family_health: 11.99,
};
```

- [ ] **Step 2: Repository (join users ⟕ subscriptions)**

`src/modules/admin/admin.repository.ts` :
```ts
import { Inject, Injectable } from '@nestjs/common';
import { count, eq, ilike, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { users, subscriptions } from '../../db/schema';

export type AdminUserRow = {
  id: string;
  email: string;
  role: string;
  isDemoAccount: boolean;
  createdAt: Date;
  planKey: string | null;
  status: string | null;
  source: string | null;
  currentPeriodEnd: Date | null;
  stripeCustomerId: string | null;
};

@Injectable()
export class AdminRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async listUsersWithSubscription(
    opts: { search?: string; limit: number; offset: number },
  ): Promise<AdminUserRow[]> {
    const where = opts.search ? ilike(users.email, `%${opts.search}%`) : undefined;
    return this.db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        isDemoAccount: users.isDemoAccount,
        createdAt: users.createdAt,
        planKey: subscriptions.planKey,
        status: subscriptions.status,
        source: subscriptions.source,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        stripeCustomerId: subscriptions.stripeCustomerId,
      })
      .from(users)
      .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
      .where(where)
      .orderBy(sql`${users.createdAt} desc`)
      .limit(opts.limit)
      .offset(opts.offset) as Promise<AdminUserRow[]>;
  }

  async countAll(search?: string): Promise<number> {
    const where = search ? ilike(users.email, `%${search}%`) : undefined;
    const rows = await this.db.select({ value: count() }).from(users).where(where);
    return Number(rows[0]?.value ?? 0);
  }
}
```

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: succès (si import `and` inutilisé rejeté par eslint au build, le retirer).

- [ ] **Step 4: Commit (suggéré)**

```
feat(admin): AdminRepository (join users/subscriptions) + prix mensuels
```

---

## Task 4: `AdminService` (liste + métriques + override)

**Files:**
- Create: `src/modules/admin/admin.service.ts`
- Test: `src/modules/admin/admin.service.spec.ts`

- [ ] **Step 1: Test (écris-le, vérifie l'échec)**

`src/modules/admin/admin.service.spec.ts` :
```ts
import { describe, it, expect, vi } from 'vitest';
import { AdminService } from './admin.service';
import type { AdminRepository, AdminUserRow } from './admin.repository';
import type { SubscriptionRepository } from '../entitlements/subscription.repository';

function row(over: Partial<AdminUserRow> = {}): AdminUserRow {
  return {
    id: 'u1', email: 'a@b.com', role: 'user', isDemoAccount: false, createdAt: new Date('2026-01-01'),
    planKey: null, status: null, source: null, currentPeriodEnd: null, stripeCustomerId: null,
    ...over,
  };
}
const repo = (rows: AdminUserRow[], total = rows.length): AdminRepository =>
  ({ listUsersWithSubscription: vi.fn().mockResolvedValue(rows), countAll: vi.fn().mockResolvedValue(total) }) as unknown as AdminRepository;
const subRepo = (): SubscriptionRepository =>
  ({ upsertByUserId: vi.fn().mockResolvedValue({}) }) as unknown as SubscriptionRepository;

describe('AdminService.listUsers', () => {
  it('mappe chaque user vers son plan effectif (sans souscription → solo)', async () => {
    const svc = new AdminService(repo([row()]), subRepo());
    const res = await svc.listUsers({ limit: 20, offset: 0 });
    expect(res.total).toBe(1);
    expect(res.items[0]).toMatchObject({ email: 'a@b.com', effectivePlan: 'solo', status: null, paid: false });
  });

  it('un abonné stripe actif est marqué payé', async () => {
    const svc = new AdminService(repo([row({ planKey: 'family', status: 'active', source: 'stripe' })]), subRepo());
    const res = await svc.listUsers({ limit: 20, offset: 0 });
    expect(res.items[0]).toMatchObject({ effectivePlan: 'family', paid: true });
  });

  it('un abonnement canceled est dégradé en solo (effectif)', async () => {
    const svc = new AdminService(repo([row({ planKey: 'family', status: 'canceled', source: 'stripe' })]), subRepo());
    const res = await svc.listUsers({ limit: 20, offset: 0 });
    expect(res.items[0]).toMatchObject({ effectivePlan: 'solo', paid: false });
  });
});

describe('AdminService.metrics', () => {
  it('compte par plan effectif + MRR des abonnés stripe actifs', async () => {
    const rows = [
      row({ planKey: 'family', status: 'active', source: 'stripe' }),
      row({ id: 'u2', planKey: 'family_health', status: 'active', source: 'stripe' }),
      row({ id: 'u3' }), // solo
      row({ id: 'u4', planKey: 'family', status: 'past_due', source: 'stripe' }), // dégradé solo, pas de MRR
    ];
    const svc = new AdminService(repo(rows, 4), subRepo());
    const m = await svc.metrics();
    expect(m.totalUsers).toBe(4);
    expect(m.byPlan).toMatchObject({ solo: 2, family: 1, family_health: 1 });
    expect(m.mrr).toBeCloseTo(6.99 + 11.99, 2);
    expect(m.pastDue).toBe(1);
  });
});

describe('AdminService.overridePlan', () => {
  it('upsert le plan avec source admin', async () => {
    const subs = subRepo();
    const svc = new AdminService(repo([]), subs);
    await svc.overridePlan('u1', 'family_health');
    expect(subs.upsertByUserId).toHaveBeenCalledWith('u1', { planKey: 'family_health', status: 'active', source: 'admin' });
  });
});
```
Run: `pnpm test admin.service` → FAIL.

- [ ] **Step 2: Implémentation**

`src/modules/admin/admin.service.ts` :
```ts
import { Injectable } from '@nestjs/common';
import { AdminRepository, type AdminUserRow } from './admin.repository';
import { SubscriptionRepository } from '../entitlements/subscription.repository';
import { resolveEntitlement, type SubscriptionSnapshot, type SubscriptionStatus, type EntitlementSource } from '../entitlements/entitlement.resolver';
import { PLAN_MONTHLY_PRICE } from './plan-pricing';
import { PLAN_CATALOG, type PlanKey } from '../entitlements/plan-catalog';

export type AdminUserView = {
  id: string;
  email: string;
  role: string;
  isDemoAccount: boolean;
  createdAt: Date;
  effectivePlan: PlanKey;
  status: SubscriptionStatus | null;
  source: EntitlementSource | null;
  currentPeriodEnd: Date | null;
  hasStripeCustomer: boolean;
  paid: boolean;
};

const ACTIVE: ReadonlyArray<string> = ['active', 'trialing'];

function snapshot(row: AdminUserRow): SubscriptionSnapshot | null {
  if (!row.planKey || !row.status || !row.source) return null;
  return {
    planKey: row.planKey as PlanKey,
    status: row.status as SubscriptionStatus,
    source: row.source as EntitlementSource,
    currentPeriodEnd: row.currentPeriodEnd,
  };
}

function toView(row: AdminUserRow, now: Date): AdminUserView {
  const effective = resolveEntitlement(snapshot(row), now).planKey;
  const paid = row.source === 'stripe' && !!row.status && ACTIVE.includes(row.status);
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    isDemoAccount: row.isDemoAccount,
    createdAt: row.createdAt,
    effectivePlan: effective,
    status: (row.status as SubscriptionStatus | null) ?? null,
    source: (row.source as EntitlementSource | null) ?? null,
    currentPeriodEnd: row.currentPeriodEnd,
    hasStripeCustomer: !!row.stripeCustomerId,
    paid,
  };
}

@Injectable()
export class AdminService {
  constructor(
    private readonly admin: AdminRepository,
    private readonly subscriptions: SubscriptionRepository,
  ) {}

  async listUsers(opts: { search?: string; limit: number; offset: number }): Promise<{ items: AdminUserView[]; total: number }> {
    const now = new Date();
    const [rows, total] = await Promise.all([
      this.admin.listUsersWithSubscription(opts),
      this.admin.countAll(opts.search),
    ]);
    return { items: rows.map((r) => toView(r, now)), total };
  }

  async metrics(): Promise<{
    totalUsers: number;
    byPlan: Record<PlanKey, number>;
    activeSubscriptions: number;
    trialing: number;
    pastDue: number;
    mrr: number;
  }> {
    const now = new Date();
    // Récupère tout (limite haute) pour agréger ; le volume reste modeste (app famille).
    const rows = await this.admin.listUsersWithSubscription({ limit: 100000, offset: 0 });
    const byPlan: Record<PlanKey, number> = { solo: 0, family: 0, family_health: 0 };
    let activeSubscriptions = 0;
    let trialing = 0;
    let pastDue = 0;
    let mrr = 0;
    for (const r of rows) {
      const effective = resolveEntitlement(snapshot(r), now).planKey;
      byPlan[effective] += 1;
      if (r.status === 'past_due') pastDue += 1;
      if (r.source === 'stripe' && r.status && ACTIVE.includes(r.status)) {
        if (r.status === 'trialing') trialing += 1;
        else activeSubscriptions += 1;
        mrr += PLAN_MONTHLY_PRICE[r.planKey as PlanKey] ?? 0;
      }
    }
    return { totalUsers: rows.length, byPlan, activeSubscriptions, trialing, pastDue, mrr };
  }

  async overridePlan(userId: string, planKey: PlanKey): Promise<void> {
    // Garde : ne valide que des plans connus.
    if (!PLAN_CATALOG[planKey]) return;
    await this.subscriptions.upsertByUserId(userId, { planKey, status: 'active', source: 'admin' });
  }
}
```
> `metrics()` recharge la liste complète (volume modeste). Si l'app grossit, remplacer par des `count()` agrégés SQL — hors périmètre ici (YAGNI).

Run: `pnpm test admin.service` → PASS.

- [ ] **Step 3: Build + suite**

Run: `pnpm build && pnpm test`
Expected: vert.

- [ ] **Step 4: Commit (suggéré)**

```
feat(admin): AdminService liste + métriques (MRR) + override
```

---

## Task 5: DTO + Controller + Module + wiring

**Files:**
- Create: `src/modules/admin/dto/admin.dto.ts`, `src/modules/admin/admin.controller.ts`, `src/modules/admin/admin.module.ts`
- Test: `src/modules/admin/admin.controller.spec.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: DTO**

`src/modules/admin/dto/admin.dto.ts` :
```ts
import { z } from 'zod';

export const listQuerySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListQueryDto = z.infer<typeof listQuerySchema>;

export const overridePlanSchema = z.object({
  planKey: z.enum(['solo', 'family', 'family_health']),
});
export type OverridePlanDto = z.infer<typeof overridePlanSchema>;
```

- [ ] **Step 2: Test controller (écris-le, vérifie l'échec)**

`src/modules/admin/admin.controller.spec.ts` :
```ts
import { describe, it, expect, vi } from 'vitest';
import { AdminController } from './admin.controller';
import type { AdminService } from './admin.service';

const svc = (over: Partial<AdminService> = {}): AdminService =>
  ({
    listUsers: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    metrics: vi.fn().mockResolvedValue({ totalUsers: 0, byPlan: { solo: 0, family: 0, family_health: 0 }, activeSubscriptions: 0, trialing: 0, pastDue: 0, mrr: 0 }),
    overridePlan: vi.fn().mockResolvedValue(undefined),
    ...over,
  }) as unknown as AdminService;

describe('AdminController', () => {
  it('users : convertit page/pageSize en limit/offset', async () => {
    const service = svc();
    const c = new AdminController(service);
    await c.users({ search: 'a', page: 2, pageSize: 20 });
    expect(service.listUsers).toHaveBeenCalledWith({ search: 'a', limit: 20, offset: 20 });
  });

  it('metrics : délègue au service', async () => {
    const service = svc();
    const c = new AdminController(service);
    const m = await c.metrics();
    expect(m.totalUsers).toBe(0);
  });

  it('override : passe id + planKey', async () => {
    const service = svc();
    const c = new AdminController(service);
    const res = await c.override('u1', { planKey: 'family' });
    expect(service.overridePlan).toHaveBeenCalledWith('u1', 'family');
    expect(res).toEqual({ ok: true });
  });
});
```
Run: `pnpm test admin.controller` → FAIL.

- [ ] **Step 3: Controller**

`src/modules/admin/admin.controller.ts` :
```ts
import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { parseBody } from '../../common/parse-body';
import { AdminService } from './admin.service';
import { listQuerySchema, overridePlanSchema } from './dto/admin.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  users(@Query() query: Record<string, unknown>) {
    const { search, page, pageSize } = parseBody(listQuerySchema, query);
    return this.admin.listUsers({ search, limit: pageSize, offset: (page - 1) * pageSize });
  }

  @Get('metrics')
  metrics() {
    return this.admin.metrics();
  }

  @UseGuards(CsrfGuard)
  @Patch('users/:id/plan')
  async override(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    const { planKey } = parseBody(overridePlanSchema, body);
    await this.admin.overridePlan(id, planKey);
    return { ok: true };
  }
}
```
Run: `pnpm test admin.controller` → PASS.

- [ ] **Step 4: Module**

`src/modules/admin/admin.module.ts` :
```ts
import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminRepository } from './admin.repository';

@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminRepository],
})
export class AdminModule {}
```
(`SubscriptionRepository` vient de `EntitlementsModule` @Global ; `RolesGuard` lit `DRIZZLE` @Global.)

- [ ] **Step 5: Enregistrer dans `app.module.ts`**

- Import en tête : `import { AdminModule } from './modules/admin/admin.module';`
- Dans `imports`, après `BillingModule` : `AdminModule,`.

- [ ] **Step 6: Build + suite complète**

Run: `pnpm build && pnpm test`
Expected: build OK, **toute** la suite verte.

- [ ] **Step 7: Commit (suggéré)**

```
feat(admin): endpoints /admin users, metrics, override plan + module
```

---

## Definition of Done (Phase 5 back)

- [ ] `pnpm build` + `pnpm test` verts (anciens + ~14 nouveaux).
- [ ] `RolesGuard` + `@Roles('admin')` (rôle lu en base, 403/401 corrects).
- [ ] `GET /admin/users` paginé + recherche email → métadonnées de facturation **seulement** (E2EE préservé), plan effectif via resolver, flag `paid`.
- [ ] `GET /admin/metrics` : par plan + actifs/essais/past_due + **MRR**.
- [ ] `PATCH /admin/users/:id/plan` (JWT+Roles+CSRF) → override `source: 'admin'`.
- [ ] `role` exposé dans la réponse user (pour le gating front).

## Notes de clôture — Front admin (cycle AAK Angular ensuite)

1. **`role` dans le front** : ajouter `role: 'user' | 'admin'` au type `AuthUser` (`auth.store.ts`) — alimenté par la réponse `/auth/me` désormais enrichie.
2. **`adminGuard`** (`CanMatchFn`) : `inject(AuthStore).user()?.role === 'admin'` sinon redirect app (ou 404).
3. **Route `/admin`** sous l'app shell + page : table users (email, plan effectif, statut, badge source, fin de période, date, démo) + filtres (plan/statut/recherche) + bandeau métriques (MRR, par plan, past_due) + action override (PATCH) + lien Stripe customer. Design via skill `impeccable` (registre product, DESIGN.md).
4. Smoke : se connecter avec le compte owner (role admin, seedé Phase 0) → `/admin` accessible ; un user normal → bloqué.
