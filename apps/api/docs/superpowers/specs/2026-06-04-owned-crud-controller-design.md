# `OwnedCrudController<T>` — Design (R1, factorisation controllers CRUD)

**Statut :** validé (brainstorming 2026-06-04). Prochaine étape : writing-plans.

## Objectif
Collapser la duplication (~8.83 %, 36 clones jscpd) des controllers CRUD backend en une base abstraite décorée, **sans changer le contrat HTTP**. Sert 3 buts : réduire la dedup réelle (list/getOne/create/update/remove), faciliter l'ajout d'entités futures, uniformiser la forme.

## Périmètre

**Inclus (12 controllers, quintet CRUD complet) :** `patients`, `practitioners`, `appointments`, `medications`, `reminders`, `documents`, `prescriptions`, `recurring-entries`, `salary-archives`, `account-transactions`, `envelopes`, `loans`.

**Exclus (décidé) :**
- `medical-calendar` (read-only, pas CRUD), `shared-access` (pas d'update).
- `bank-accounts`, `consumables`, `members` (pas de `getOne` aujourd'hui → on n'ajoute pas de route `GET /:id` ; zéro changement d'API).

## Architecture

### Base — `src/common/crud/owned-crud.controller.ts`
```ts
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
  /** Mapping body → valeurs de création (inclut la branche encryptedData vs plaintext, par entité). */
  protected abstract toCreateValues(body: Record<string, unknown>): Record<string, unknown>;
  /** Mapping body → patch de mise à jour (idem). */
  protected abstract toUpdatePatch(body: Record<string, unknown>): Record<string, unknown>;

  @Get()
  list(@CurrentUser() u: AuthUser) { return this.svc.list(u.id); }

  @Get(':id')
  async getOne(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.#orThrow(u.id, id);
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
    await this.#orThrow(u.id, id);
    await this.svc.remove(u.id, id);
  }

  async #orThrow(userId: string, id: string): Promise<T> {
    const row = await this.svc.getOne(userId, id);
    if (!row) throw new NotFoundException('Not found');
    return row;
  }
}
```

### Controllers concrets
```ts
@Controller('salary-archives')
export class SalaryArchivesController extends OwnedCrudController<SalaryArchive> {
  constructor(protected readonly svc: SalaryArchivesService, private readonly storage: StorageService) { super(); }
  protected toCreateValues(b) { /* branche encrypted/plaintext + mapping champs (inchangé) */ }
  protected toUpdatePatch(b)  { /* idem update */ }
  // extras inchangés : @Post(':id/payslip'), @Get(':id/payslip'), @Delete(':id/payslip')
}
```
- Les **extras** (Patch `updateStatus`, `@Post()` batch, sous-routes fichier upload/download) restent des **méthodes décorées normales** dans la sous-classe. La base ne les concerne pas.
- Le mapping `toCreateValues`/`toUpdatePatch` est **repris tel quel** depuis le corps actuel des `create`/`update` (zéro changement de logique métier ni de schémas Zod).

## Error handling
- `NotFound` centralisé dans `#orThrow` (comportement identique à l'actuel `if (!row) throw new NotFoundException`).
- Validation Zod (`parseBody(schema, body)`) **reste dans les hooks** par entité (schémas inchangés).

## Risque principal & stratégie de vérification
- **Risque n°1 : héritage de routes décorées NestJS** (décorateurs `@Get/@Post/...` + `@CurrentUser` + guards hérités d'une classe de base abstraite). C'est un terrain à sharp-edges.
- **Spike-first (obligatoire) :** migrer **`patients` en premier**, écrire/étendre un **e2e** prouvant que les 5 routes répondent correctement (200/201/204/404) et que `JwtAuthGuard`+`CsrfGuard` s'appliquent bien aux routes héritées. **Si le spike échoue → pivot vers l'approche B (helpers minimalistes), pas de déploiement.**
- **Rollout : un controller à la fois**, `pnpm build` + tests unitaires du module + **e2e vert** (filets : `test/finance.e2e-spec.ts`, `test/medical.e2e-spec.ts`) à chaque étape. Jamais de big-bang.

## Hors-scope (volontaire)
- R3 (dé-abstraction gateways front) — reconsidéré, déconseillé.
- Les 5 controllers exclus ci-dessus.
- Toute modif de schéma Zod, de service, de repository ou de DB.

## Critères de succès
- jscpd backend nettement sous 8.83 % sur les controllers migrés.
- 0 changement de contrat HTTP (e2e verts inchangés).
- `pnpm build` + `pnpm test` + e2e verts.
