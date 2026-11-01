# Phase B5a — Modules data Finance (NestJS)

**Date :** 2026-05-31
**Repo :** `nest-dashflow-app`
**Statut :** approuvé, prêt pour plan d'implémentation
**Dépend de :** B0 (schéma, DrizzleModule), B1 (JwtAuthGuard, CsrfGuard, Result)

## Contexte

Premier lot des modules data (B5). Port fidèle des routes CRUD finance de Hono vers
NestJS. Établit la **base CRUD partagée** réutilisée par B5b (médical) et B5c
(transverses). Backend-only (big-bang). Schéma déjà porté (B0).

Découpage B5 : **B5a Finance** (ce spec) · B5b Médical · B5c Transverses.

## Pattern de module (réutilisable B5a/b/c)

- **`OwnedCrudService<TTable>`** (`src/common/crud/owned-crud.service.ts`) : helper
  générique paramétré par la table Drizzle + `DRIZZLE`. Méthodes scopées `userId` :
  - `list(userId): Promise<Row[]>` — `select where userId` (limit 100).
  - `getOne(userId, id): Promise<Result<Row>>` — 404 si absent/non possédé.
  - `create(userId, values): Promise<Row>` — insert `{ ...values, userId }` returning.
  - `update(userId, id, patch): Promise<Result<Row>>` — update where id+userId, 404.
  - `remove(userId, id): Promise<void>` — delete where id+userId.
  - Ownership systématique via `and(eq(table.id,id), eq(table.userId,userId))`.
- **Double mode `encryptedData`** : géré explicitement dans le service/controller de
  module — si `body.encryptedData` présent → schéma chiffré (stocke `encryptedData` +
  placeholders minimaux), sinon schéma plaintext. Le service construit l'objet `values`
  puis délègue à la base.
- **Structure module** : `src/modules/<feature>/<feature>.{module,controller,service}.ts`
  + `dto/`. Controller : routes + `ZodValidationPipe` + `@UseGuards(JwtAuthGuard)` (GET)
  / `@UseGuards(JwtAuthGuard, CsrfGuard)` (mutations) + `@CurrentUser()`. Monté sous
  `/api/<feature>` (préfixe global `/api` déjà actif).
- **Transactions SQL** (crédit balance, recompute, snapshot) : `db.transaction(...)`
  dans le service du module.
- ⚠️ Rappel : dates en `sql` brut → `toISOString()` ; ici on passe par Drizzle typé
  donc OK, mais les dates de transaction utilisent `new Date().toISOString().slice(0,10)`
  (format `date`).

## Modules (port fidèle — source : `dash-flow/backend/src/routes/*.routes.ts`)

| Module | Préfixe | Routes |
|---|---|---|
| `bank-accounts` | `/api/bank-accounts` | `GET /`, `POST /`, `PUT /:id`, `DELETE /:id` (double mode) |
| `consumables` | `/api/consumables` | `GET /`, `POST /`, `PUT /:id`, `DELETE /:id` (**plaintext** : pas d'`encryptedData`) |
| `envelopes` | `/api/envelopes` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`, `GET /transactions/all` (JOIN), `GET /:id/transactions`, `POST /:id/transactions`, `PATCH /:id/balance` (transaction SQL : maj balance + insert transaction) |
| `loans` | `/api/loans` | CRUD + transactions + recompute `remaining` (transaction SQL) — parité `loan.routes.ts` |
| `recurring-entries` | `/api/recurring-entries` | CRUD double mode (champs `type/transfert/accountId/payslipKey`) — parité `recurring-entry.routes.ts` |
| `salary-archives` | `/api/salary-archives` | CRUD + snapshot `spendings` (jsonb) — parité `salary-archive.routes.ts` |

Chaque route porte la sémantique Hono à l'identique (codes 200/201/204/404, mode
chiffré/plaintext, ownership userId). Le port des champs/validation se fait depuis les
schémas `validation.ts` et les `*.routes.ts` Hono (lus pendant l'implémentation).

## Tests & critères de succès

**Tests** :
- Unit `OwnedCrudService` : CRUD scopé userId ; `getOne`/`update` d'un id non possédé → 404 ; `remove` idempotent.
- Unit par module : double mode (encrypted vs plaintext → bon `values`) ; logique
  spécifique (crédit balance → balance maj + transaction insérée dans une transaction
  SQL ; loan `remaining` recalculé ; salary snapshot `spendings`).
- e2e (vraie DB) : `bank-accounts` (CRUD + ownership cross-user 404) et `envelopes`
  (CRUD + POST transaction + PATCH balance) via session cookie.

**Critères** :
1. `OwnedCrudService` : CRUD scopé userId, 404 cross-user.
2. 6 modules finance exposent leurs routes (parité Hono) sous `/api/<feature>`, guards
   Jwt (+CSRF mutations).
3. Double mode `encryptedData`/plaintext OK (create/update).
4. Crédit balance (transaction SQL), loan `remaining`, salary snapshot corrects.
5. e2e bank-accounts + envelopes verts ; ownership cross-user refusée.
6. Tous les tests verts ; aucune régression auth (B1-B4).

## Hors-périmètre

- B5b (médical : patients/members, practitioners, appointments, prescriptions,
  medications, documents), B5c (reminders, shared-access, medical-calendar iCal).
- Upload de fichiers réel (`payslipKey`, `documentUrl` → S3/R2) — champs stockés tels
  quels ; l'upload est une étape S3/R2 dédiée.
- Bascule front + décommission Hono (B-final).
