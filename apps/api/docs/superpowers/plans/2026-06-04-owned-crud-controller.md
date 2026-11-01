# OwnedCrudController<T> — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (exécution inline, checkpoint après chaque tâche). Steps en checkbox (`- [ ]`).

**Goal:** Introduire une base abstraite `OwnedCrudController<T>` factorisant les 5 endpoints CRUD standards, et y migrer 12 controllers **sans changer le contrat HTTP**.

**Architecture:** Classe abstraite décorée (`@UseGuards(JwtAuthGuard)` + `@Get/@Post/@Put/@Delete`) avec 2 hooks abstraits (`toCreateValues`, `toUpdatePatch`). Chaque controller `extends` la base, fournit les hooks (= corps actuels de `create`/`update`, déplacés tels quels), garde ses extras (Patch, batch, sous-routes fichier) comme méthodes décorées, et **override `remove`** s'il pré-checke aujourd'hui.

**Tech Stack:** NestJS, Drizzle, Zod, Vitest (+ e2e supertest). Gates : `pnpm build` + `CI=true pnpm test` + e2e du module (`test/finance.e2e-spec.ts`, `test/medical.e2e-spec.ts`).

**Spec :** `docs/superpowers/specs/2026-06-04-owned-crud-controller-design.md`.

---

## Task 1 : Base abstraite + interface

**Files:** Create `src/common/crud/owned-crud.controller.ts`

- [ ] **Step 1 — Écrire la base** (code complet) :
```ts
import {
  Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Put, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CsrfGuard } from '../guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../decorators/current-user.decorator';

export interface CrudService<T> {
  list(userId: string): Promise<T[]>;
  getOne(userId: string, id: string): Promise<T | undefined>;
  create(userId: string, values: Record<string, unknown>): Promise<T>;
  update(userId: string, id: string, patch: Record<string, unknown>): Promise<T | undefined>;
  remove(userId: string, id: string): Promise<void>;
}

@UseGuards(JwtAuthGuard)
export abstract class OwnedCrudController<T> {
  protected abstract readonly svc: CrudService<T>;
  protected abstract toCreateValues(body: Record<string, unknown>): Record<string, unknown>;
  protected abstract toUpdatePatch(body: Record<string, unknown>): Record<string, unknown>;

  @Get()
  list(@CurrentUser() u: AuthUser) {
    return this.svc.list(u.id);
  }

  @Get(':id')
  async getOne(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const row = await this.svc.getOne(u.id, id);
    if (!row) throw new NotFoundException('Not found');
    return row;
  }

  @UseGuards(CsrfGuard) @Post() @HttpCode(201)
  create(@CurrentUser() u: AuthUser, @Body() body: Record<string, unknown>) {
    return this.svc.create(u.id, this.toCreateValues(body));
  }

  @UseGuards(CsrfGuard) @Put(':id')
  async update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const row = await this.svc.update(u.id, id, this.toUpdatePatch(body));
    if (!row) throw new NotFoundException('Not found');
    return row;
  }

  @UseGuards(CsrfGuard) @Delete(':id') @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.svc.remove(u.id, id);
  }
}
```
> Note : `remove` de la base = **sans pré-check** (DELETE idempotent → 204), comme `patients`/`practitioners`. Les controllers qui pré-checkent (ex. `salary-archives`) **overrideront** `remove`.

- [ ] **Step 2 — Build** : `pnpm build` → succès (la base ne casse rien, pas encore utilisée).
- [ ] **Step 3 — Commit suggéré** : `refactor(crud): add OwnedCrudController base + CrudService interface`

---

## Task 2 : SPIKE — migrer `patients` + e2e (PORTE DE DÉCISION)

**Files:** Modify `src/modules/patients/patients.controller.ts` ; Test `test/medical.e2e-spec.ts` (étendre).

- [ ] **Step 1 — e2e d'abord** : dans `test/medical.e2e-spec.ts`, vérifier (ou ajouter si absent) un bloc patients prouvant les routes héritées + guards :
```ts
// GET /patients sans cookie → 401 (JwtAuthGuard hérité actif)
await request(app.getHttpServer()).get('/patients').expect(401);
// POST /patients sans CSRF → 403 (CsrfGuard hérité actif)
await request(app.getHttpServer()).post('/patients').set('Cookie', authCookie).send({ firstName:'A', lastName:'B', birthDate:'1970-01-01' }).expect(403);
// cycle authentifié: create 201 → list 200 contient → getOne 200 → update 200 → getOne 404 après delete
```
- [ ] **Step 2 — Lancer l'e2e, le voir ÉCHOUER** (routes pas encore héritées si comportement diffère) : `pnpm test:e2e` (ou la commande e2e du repo).
- [ ] **Step 3 — Migrer le controller** :
```ts
import { Body, Controller } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { parseBody } from '../../common/parse-body';
import { createPatientSchema, createEncryptedPatientSchema } from './dto/patient.dto';
import { OwnedCrudController } from '../../common/crud/owned-crud.controller';
import type { Patient } from '../../db/schema'; // type $inferSelect approprié

@Controller('patients')
export class PatientsController extends OwnedCrudController<Patient> {
  constructor(protected readonly svc: PatientsService) { super(); }

  protected toCreateValues(body: Record<string, unknown>) {
    if (body.encryptedData) {
      const { encryptedData } = parseBody(createEncryptedPatientSchema, body);
      return { firstName: '', lastName: '', birthDate: '1970-01-01', encryptedData };
    }
    const d = parseBody(createPatientSchema, body);
    return { firstName: d.firstName, lastName: d.lastName, birthDate: d.birthDate, color: d.color ?? null, notes: d.notes ?? null };
  }

  protected toUpdatePatch(body: Record<string, unknown>) {
    return body.encryptedData
      ? { encryptedData: body.encryptedData }
      : (({ id: _i, userId: _u, createdAt: _c, ...rest }) => rest)(body);
  }
}
```
> `patients.remove` actuel = pas de pré-check → **pas d'override** (la base convient). Le message NotFound passe de 'Non trouvé' à 'Not found' (cosmétique ; ajuster l'e2e si une assertion porte sur le message).

- [ ] **Step 4 — Build + e2e VERTS** : `pnpm build` puis e2e patients verts. Vérifier `PatientsService` satisfait `CrudService<Patient>` (méthodes `list/getOne/create/update/remove` présentes — c'est déjà le cas, le controller les appelait).
- [ ] **Step 5 — PORTE DE DÉCISION** : si l'héritage de routes/guards ne fonctionne pas (routes 404, guards inactifs), **STOP** → pivoter vers l'approche B (helpers minimalistes), ne pas continuer le rollout.
- [ ] **Step 6 — Commit suggéré** : `refactor(patients): migrate to OwnedCrudController (spike)`

---

## Tasks 3–13 : migrer les 11 controllers restants (un par tâche)

Ordre : **finance d'abord (e2e finance), puis medical**. Pour CHAQUE controller, même recette :

**Procédure générique (à appliquer par controller) :**
- [ ] **A — Audit `remove`** : ouvrir le controller. Si son `remove` actuel fait `getOne` + `NotFoundException` avant `svc.remove`, **override** dans la sous-classe :
```ts
@UseGuards(CsrfGuard) @Delete(':id') @HttpCode(204)
async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
  const row = await this.svc.getOne(u.id, id);
  if (!row) throw new NotFoundException('Not found');
  await this.svc.remove(u.id, id);
}
```
  Sinon, ne pas redéfinir `remove`.
- [ ] **B — Déplacer le mapping** : `extends OwnedCrudController<X>`, ajouter `super()` au constructeur, déplacer le corps de `create()` actuel dans `toCreateValues(body)` et le corps de `update()` dans `toUpdatePatch(body)` **sans changer la logique** (schémas Zod, branche encrypted, mapping champs identiques). Supprimer les méthodes `list`/`getOne`/`create`/`update` désormais héritées.
- [ ] **C — Conserver les extras** tels quels (méthodes décorées) : voir colonne « extras » ci-dessous.
- [ ] **D — Gates** : `pnpm build` + `CI=true pnpm test` (specs du module) + e2e du domaine (`finance` ou `medical`) **verts**.
- [ ] **E — Commit suggéré** : `refactor(<entity>): migrate to OwnedCrudController`

**Table par controller (extras à garder = méthodes restant dans la sous-classe) :**

| Task | Controller | Extras à conserver (hors quintet) |
|---|---|---|
| 3 | `recurring-entries` | sous-routes `:id/...` (3 routes fichier/extra) |
| 4 | `salary-archives` | `@Post(':id/payslip')`, `@Get(':id/payslip')`, `@Delete(':id/payslip')` + **override remove** (pré-check actuel) |
| 5 | `loans` | `@Get` extra (sous-ressource), `@Post` extra, `@Patch` |
| 6 | `envelopes` | `@Get` extras, `@Post` extra, `@Patch` |
| 7 | `account-transactions` | `@Post` batch (2ᵉ Post), `@Get` extra |
| 8 | `appointments` | `@Patch` (updateStatus) |
| 9 | `medications` | `@Get` extra, `@Patch` |
| 10 | `reminders` | `@Patch` (toggle) |
| 11 | `documents` | sous-routes fichier (`@Post`/`@Get`/`@Delete` `:id/...`) |
| 12 | `prescriptions` | sous-routes document (`@Post`/`@Get`/`@Delete` `:id/...`) |
| 13 | `practitioners` | aucun (quintet pur) |

> Pour chaque controller : vérifier en B que le service expose bien `CrudService<X>` (méthodes déjà appelées par le controller → garanti). Les imports devenus inutiles (`Get`, `Post`, etc. si plus utilisés directement) doivent être retirés (le build/lint le signalera).

---

## Task 14 : Vérification finale

- [ ] **Step 1 — jscpd** : `pnpm dlx jscpd src/modules --min-tokens 70 --min-lines 10` → duplication controllers nettement sous 8.83 %.
- [ ] **Step 2 — Suite complète** : `pnpm build` + `CI=true pnpm test` (69+ verts) + e2e finance + medical verts.
- [ ] **Step 3 — Diff propre** : `git status` ne montre que les 12 controllers + la base. Aucun changement de schéma/service/DB.

---

## Self-review
- **Couverture spec** : base+interface (T1), spike patients+e2e+porte de décision (T2), 12 controllers migrés (T2–T13), exclusions respectées (medical-calendar, shared-access, bank-accounts, consumables, members absents), vérif finale jscpd+e2e (T14). ✓
- **Placeholders** : base + patients = code complet ; T3–T13 = transform mécanique « déplacer le corps existant » (le code source est la référence) + table extras concrète + override remove conditionnel explicite. ✓
- **Cohérence types** : `CrudService<T>` (list/getOne/create/update/remove) = méthodes déjà appelées par les controllers ; hooks `toCreateValues`/`toUpdatePatch` nommés identiquement partout. ✓
- **Risque** : héritage routes/guards NestJS → porte de décision T2 avec pivot approche B. ✓
