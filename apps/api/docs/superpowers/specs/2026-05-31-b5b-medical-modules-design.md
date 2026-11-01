# Phase B5b — Modules data Médical (NestJS)

**Date :** 2026-05-31
**Repo :** `nest-dashflow-app`
**Statut :** approuvé, prêt pour plan d'implémentation
**Dépend de :** B5a (base `OwnedCrudService`, `parseBody`, pattern module)

## Contexte

Deuxième lot des modules data. Port fidèle des routes médicales de Hono, sur la base
CRUD partagée éprouvée en B5a. Backend-only. Schéma déjà porté (B0, `medical.ts`).

## Modules (pattern B5a : `OwnedCrudService` + double mode `encryptedData` + `@UseGuards(JwtAuthGuard)`/`CsrfGuard` mutations + `parseBody`, `imports:[AuthModule]`, monté sous `/api/<feature>`)

| Module | Préfixe | Routes (parité Hono) |
|---|---|---|
| `patients` | `/api/patients` | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` (double mode) |
| `members` | `/api/members` | alias `patients` : `GET /` (cols `id,firstName,lastName,color,encryptedData`) + `PATCH /:id/color` |
| `practitioners` | `/api/practitioners` | CRUD double mode |
| `appointments` | `/api/appointments` | CRUD + `PATCH /:id/status` |
| `medications` | `/api/medications` | CRUD + `GET /alerts` + `PATCH /:id/refill` |
| `prescriptions` | `/api/prescriptions` | CRUD + `GET /by-appointment/:appointmentId` |
| `documents` | `/api/documents` | CRUD + `GET /by-patient/:patientId` |

**Sources de port (lire à l'implémentation) :** `dash-flow/backend/src/routes/{patient,member,practitioner,appointment,medication,prescription,document}.routes.ts` + `validation.ts`.

## Specials (port exact)

- **members** = module léger sur la table `patients` (pas de table dédiée) : `GET /`
  renvoie le sous-ensemble de colonnes ; `PATCH /:id/color` met à jour `color` (schéma
  `updateMemberColorSchema`). Ownership `userId`.
- **appointments** `PATCH /:id/status` : maj enum `status`
  (`scheduled|completed|cancelled|no_show`).
- **medications** : `GET /alerts` (port **exact** de la logique de stock bas Hono —
  calcul quantité vs `dailyRate`/`alertDaysBefore`) ; `PATCH /:id/refill` (ajoute du
  stock).
- **prescriptions** `GET /by-appointment/:appointmentId` ; **documents**
  `GET /by-patient/:patientId` : filtres scopés `userId`.
- Routes statiques (`/alerts`, `/by-appointment/:x`, `/by-patient/:x`) déclarées
  **avant** `GET /:id` (ordre d'enregistrement NestJS).
- Cross-refs (`patientId`, `practitionerId`, `appointmentId`, `prescriptionId`) =
  champs du payload ; ownership toujours via `userId`.

## Hors-périmètre (reporté au step S3/R2)

- `prescriptions` : `GET/POST/DELETE /:id/document` (upload fichier).
- `documents` : `GET/POST/DELETE /:id/file` (upload fichier).
- Colonnes `documentUrl`/`fileUrl` préservées (settables via PUT plaintext).
- B5c (reminders, shared-access, medical-calendar iCal) ; B-final.

## Tests & critères de succès

**Tests** :
- Unit sur les specials : `members` (GET subset + PATCH color, 404 cross-user),
  `appointments` status, `medications` alerts (cas stock bas/ok) + refill,
  `prescriptions`/`documents` filtres.
- e2e (vraie DB) : `patients` (CRUD + ownership cross-user 404) et `appointments`
  (create + `PATCH /:id/status`) ou `medications` (create + refill + alerts).

**Critères** :
1. 7 modules exposent leurs routes (parité Hono) sous `/api/<feature>`, guards
   Jwt(+CSRF mutations).
2. Double mode `encryptedData`/plaintext OK.
3. Specials corrects : members color, appointment status, medication alerts/refill,
   filtres by-appointment/by-patient.
4. Ownership cross-user refusée (404).
5. Uploads non implémentés (reportés) ; colonnes url préservées.
6. Tous les tests verts ; aucune régression B1-B5a.
