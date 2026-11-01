# Modules data Médical (B5b) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Porter les 7 modules médicaux de Hono en NestJS sur la base CRUD partagée (B5a), avec leurs specials (members color, appointment status, medication alerts/refill, filtres by-X), uploads reportés.

**Architecture:** Réplique le pattern B5a : chaque module `src/modules/<feature>` étend `OwnedCrudService`, `imports:[AuthModule]`, controller `@UseGuards(JwtAuthGuard)`+`CsrfGuard` mutations, double mode encryptedData, `parseBody`, 404 via `NotFoundException`.

**Tech Stack:** NestJS, Drizzle, Zod, Vitest + supertest.

> ⚠️ J-Ned : commits locaux, **jamais de push**. Cwd : `/home/jned/WebstormProjects/DashFlow/nest-dashflow-app/`. DB up pour e2e.
> **Template de référence** : `src/modules/bank-accounts/` (CRUD simple) et `src/modules/envelopes/` (sous-ressource + ordre routes statiques). **Base** : `src/common/crud/owned-crud.service.ts`, `src/common/parse-body.ts`.
> **Sources à porter (LIRE)** : `dash-flow/backend/src/routes/{patient,member,practitioner,appointment,medication,prescription,document}.routes.ts` + `validation.ts`. Schéma : `src/db/schema/medical.ts`.
> **Règle uploads** : NE PAS porter les sous-routes fichier (`/:id/file`, `/:id/document`) — reportées au step S3/R2. Conserver les colonnes `fileUrl`/`documentUrl` (settables via PUT plaintext).
> **Règle ordre routes** : routes statiques (`/alerts`, `/by-appointment/:x`, `/by-patient/:x`) déclarées AVANT `@Get(':id')` dans la classe.

---

## File Structure

| Module | Fichiers |
|---|---|
| patients | `src/modules/patients/{dto/patient.dto.ts, patients.service.ts, patients.controller.ts, patients.module.ts}` |
| members | `src/modules/members/{members.service.ts, members.controller.ts, members.module.ts}` (+ dto color) |
| practitioners | `src/modules/practitioners/*` |
| appointments | `src/modules/appointments/*` |
| medications | `src/modules/medications/*` |
| prescriptions | `src/modules/prescriptions/*` |
| documents | `src/modules/documents/*` |
| wiring | `src/app.module.ts` (+ les 7 modules) |
| e2e | `test/medical.e2e-spec.ts` |

Chaque module = service `extends OwnedCrudService<Row>` (table correspondante de `medical.ts`), controller CRUD double mode (template bank-accounts), module `imports:[AuthModule]`.

---

## Task 1: patients + members + practitioners

**Files:** `src/modules/patients/*`, `src/modules/members/*`, `src/modules/practitioners/*`; Modify `src/app.module.ts`

- [ ] **Step 1: patients** — port `patient.routes.ts` + `validation.ts` (createPatientSchema : firstName, lastName, birthDate, color?, notes?, memberId? n/a ; createEncryptedPatientSchema : {encryptedData}). Suivre le template `bank-accounts` (CRUD + `GET /:id`). Service `extends OwnedCrudService<Patient>` (table `patients`). `@Controller('patients')`, `imports:[AuthModule]`, ajouter à `app.module.ts`.

- [ ] **Step 2: members** (module léger sur `patients`) :
`src/modules/members/members.service.ts` :
```ts
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { patients } from '../../db/schema';

@Injectable()
export class MembersService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  list(userId: string) {
    return this.db.select({
      id: patients.id, firstName: patients.firstName, lastName: patients.lastName,
      color: patients.color, encryptedData: patients.encryptedData,
    }).from(patients).where(eq(patients.userId, userId)).limit(100);
  }

  async updateColor(userId: string, id: string, color: string) {
    const rows = await this.db.update(patients).set({ color })
      .where(and(eq(patients.id, id), eq(patients.userId, userId)))
      .returning({ id: patients.id, firstName: patients.firstName, lastName: patients.lastName, color: patients.color });
    return rows[0];
  }
}
```
`src/modules/members/dto/member.dto.ts` : `export const updateMemberColorSchema = z.object({ color: z.string().regex(/^#[0-9a-fA-F]{6}$/) });` (vérifier le format exact dans `validation.ts`).
`members.controller.ts` :
```ts
import { Body, Controller, Get, NotFoundException, Param, Patch, UseGuards } from '@nestjs/common';
import { MembersService } from './members.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import { updateMemberColorSchema } from './dto/member.dto';

@UseGuards(JwtAuthGuard)
@Controller('members')
export class MembersController {
  constructor(private readonly svc: MembersService) {}
  @Get() list(@CurrentUser() u: AuthUser) { return this.svc.list(u.id); }
  @UseGuards(CsrfGuard) @Patch(':id/color')
  async color(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const { color } = parseBody(updateMemberColorSchema, body);
    const row = await this.svc.updateColor(u.id, id, color);
    if (!row) throw new NotFoundException('Non trouvé');
    return row;
  }
}
```
`members.module.ts` : `imports:[AuthModule]`, controllers:[MembersController], providers:[MembersService]. Ajouter à `app.module.ts`.

- [ ] **Step 3: practitioners** — port `practitioner.routes.ts` (CRUD double mode ; champs : name, type enum practitionerType, phone?, email?, address?, bookingUrl?). Template bank-accounts. Service `extends OwnedCrudService<Practitioner>` (table `practitioners`). Ajouter à `app.module.ts`.

- [ ] **Step 4:** `pnpm tsc --noEmit` + `pnpm test` verts. Boot smoke (DB up) : routes `/api/patients`, `/api/members`, `/api/practitioners` mappées ; **tuer serveur + libérer :3001** (`pkill -9 -f "cli/bin/nest.js start"; for P in $(ss -ltnp 2>/dev/null|grep ':3001 '|grep -oE 'pid=[0-9]+'|cut -d= -f2|sort -u); do kill -9 $P 2>/dev/null; done`).

- [ ] **Step 5: Commit** — `feat(b5b): modules patients + members + practitioners`

---

## Task 2: appointments + medications (specials)

**Files:** `src/modules/appointments/*`, `src/modules/medications/*`; Modify `src/app.module.ts`

- [ ] **Step 1: appointments** — port `appointment.routes.ts`. CRUD double mode (champs : patientId, practitionerId, date, time, status enum, reason?, outcome? ; createEncrypted : {encryptedData, patientId?, practitionerId?}). Service `extends OwnedCrudService<Appointment>` (table `appointments`) + méthode `setStatus(userId, id, status)` :
```ts
  async setStatus(userId: string, id: string, status: string) {
    return this.update(userId, id, { status });
  }
```
Controller : CRUD (template) + `@UseGuards(CsrfGuard) @Patch(':id/status')` → parseBody(`updateAppointmentStatusSchema` = `z.object({ status: z.enum(['scheduled','completed','cancelled','no_show']) })`) → `setStatus` ; 404 si undefined. Ajouter à `app.module.ts`.

- [ ] **Step 2: medications** — port `medication.routes.ts` (LIRE intégralement pour `GET /alerts` et `PATCH /:id/refill`). CRUD double mode (champs : patientId, prescriptionId?, name, type enum, dosage, quantity, dailyRate, startDate, alertDaysBefore, skipDays jsonb). Service `extends OwnedCrudService<Medication>` (table `medications`) + :
  - `alerts(userId)` : **port exact** de la logique Hono `GET /alerts` (calcul des médocs dont le stock atteint le seuil d'alerte selon `quantity`/`dailyRate`/`alertDaysBefore`).
  - `refill(userId, id, body)` : **port exact** de `PATCH /:id/refill` (ajout de stock).
Controller : `@Get('alerts')` **avant** `@Get(':id')` ; `@UseGuards(CsrfGuard) @Patch(':id/refill')` ; CRUD double mode. Ajouter à `app.module.ts`.

- [ ] **Step 3:** Unit test des specials `src/modules/medications/medications.service.spec.ts` — au moins `refill` augmente la quantité (repo/db mocké ou via une logique pure extraite). Si `alerts` est purement SQL, le couvrir en e2e (Task 4) ; si calcul en mémoire, le tester unitairement. Adapter selon le port.

- [ ] **Step 4:** `pnpm tsc --noEmit` + `pnpm test` verts. **Step 5: Commit** — `feat(b5b): modules appointments (status) + medications (alerts/refill)`

---

## Task 3: prescriptions + documents (sans upload)

**Files:** `src/modules/prescriptions/*`, `src/modules/documents/*`; Modify `src/app.module.ts`

- [ ] **Step 1: prescriptions** — port `prescription.routes.ts` SAUF les routes `/:id/document` (upload, reporté). CRUD double mode (champs : appointmentId?, practitionerId?, patientId, issuedDate, validUntil?, documentUrl?, notes?) + `GET /by-appointment/:appointmentId` (filtre scopé userId, déclaré avant `:id`). Service `extends OwnedCrudService<Prescription>` (table `prescriptions`) + :
```ts
  byAppointment(userId: string, appointmentId: string) {
    return this.db.select().from(prescriptions)
      .where(and(eq(prescriptions.userId, userId), eq(prescriptions.appointmentId, appointmentId))).limit(100);
  }
```
(importer `and, eq` + `prescriptions`). Controller : `@Get('by-appointment/:appointmentId')` avant `@Get(':id')`. **Ne pas** créer les routes `/:id/document`. Ajouter à `app.module.ts`.

- [ ] **Step 2: documents** — port `document.routes.ts` SAUF `/:id/file` (upload, reporté). CRUD double mode (champs : patientId, practitionerId?, type enum, title, date, fileUrl?, notes?) + `GET /by-patient/:patientId` (filtre scopé userId, avant `:id`). Service `extends OwnedCrudService<Document>` (table `documents`) + `byPatient(userId, patientId)` (même forme que `byAppointment`). **Ne pas** créer `/:id/file`. Ajouter à `app.module.ts`.

- [ ] **Step 3:** `pnpm tsc --noEmit` + `pnpm test` verts. Boot smoke : routes `/api/prescriptions` + `/api/documents` mappées (sans les routes fichier) ; tuer serveur + libérer :3001.

- [ ] **Step 4: Commit** — `feat(b5b): modules prescriptions + documents (uploads reportés S3/R2)`

---

## Task 4: e2e médical

**Files:** Create `test/medical.e2e-spec.ts`

- [ ] **Step 1:** e2e supertest réutilisant le helper `authedClient` (register→verify→cookie + csrf — cf. `test/finance.e2e-spec.ts`, copier le helper). Scénarios :
  - `patients` : POST (plaintext : firstName/lastName/birthDate) → 201 ; GET / contient ; 2e user → 404 sur PUT de l'id de l'autre ; DELETE → 204.
  - `appointments` : créer un patient + un practitioner, POST appointment (patientId+practitionerId+date+time) → 201 ; `PATCH /:id/status` {status:'completed'} → 200 status mis à jour.
```ts
// réutiliser exactement le bloc beforeAll + authedClient de test/finance.e2e-spec.ts
// (CapturingMailer, app init, helper). Puis les 2 it ci-dessus.
```
Codes/champs : vérifier les enums (`practitionerType` ex. 'generaliste' ; `appointmentStatus`) dans `src/db/schema/medical.ts`. Dates au format `YYYY-MM-DD`, time `HH:MM`.

- [ ] **Step 2:** `pnpm test:e2e` → tous verts (auth + oauth + finance + medical). **Step 3: Commit** — `test(b5b): e2e médical (patients + appointments)`

---

## Self-Review

**Couverture du spec :**
- 7 modules (patients, members, practitioners, appointments, medications, prescriptions, documents) → Tasks 1-3 ✓
- Specials : members color (T1), appointment status (T2), medication alerts/refill (T2), filtres by-appointment/by-patient (T3) ✓
- Double mode + ownership → template B5a réutilisé partout ✓
- Uploads reportés (pas de `/:id/file` ni `/:id/document`) → T3 (consigne explicite) ✓
- Ordre routes statiques avant `:id` → T2/T3 (consigne) ✓
- e2e patients + appointments → T4 ✓

**Placeholders :** members (special) entièrement inliné ; CRUD standard renvoie au template B5a concret + sources Hono (pattern prouvé). Specials décrits par contrat + référence source pour la logique exacte (alerts/refill). Pas de TODO.

**Cohérence des types :** services `extends OwnedCrudService<Row>` (B5a) ; `parseBody`, guards, `@CurrentUser` cohérents ; `imports:[AuthModule]` partout ; ordre routes statiques noté ; uploads exclus de façon cohérente (colonnes url conservées).
