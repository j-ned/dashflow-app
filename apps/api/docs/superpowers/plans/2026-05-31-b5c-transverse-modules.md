# Modules data Transverses (B5c) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Porter reminders, shared-access et medical-calendar (iCal public) en NestJS, complétant le portage des modules data.

**Architecture:** reminders/shared-access suivent le pattern B5a (OwnedCrudService) + specials (toggle, token+invite) ; medical-calendar est un module PUBLIC (sans guard) générant un flux iCal. Mailer étendu de `sendCalendarInvitation`.

**Tech Stack:** NestJS, Drizzle, Zod, node:crypto, Vitest + supertest.

> ⚠️ J-Ned : commits locaux, **jamais de push**. Cwd : `/home/jned/WebstormProjects/DashFlow/nest-dashflow-app/`. DB up pour e2e.
> **Sources (LIRE) :** `dash-flow/backend/src/routes/{reminder,shared-access,medical-calendar}.routes.ts`, `src/mail/mailer.ts` (sendCalendarInvitation), `validation.ts`. Schéma : `src/db/schema/{medical,shared}.ts` (reminders dans medical.ts, sharedAccess dans shared.ts).
> Pattern : `src/modules/bank-accounts/` (template), `OwnedCrudService`, `parseBody`, `imports:[AuthModule]`.

---

## File Structure

| Module | Fichiers |
|---|---|
| reminders | `src/modules/reminders/{dto/reminder.dto.ts, reminders.service.ts, reminders.controller.ts, reminders.module.ts}` |
| shared-access | `src/modules/shared-access/{dto/shared-access.dto.ts, shared-access.service.ts, shared-access.controller.ts, shared-access.module.ts}` |
| Mailer | `src/mail/mailer.ts` (+ méthode) + `src/mail/console.mailer.ts` (impl) |
| medical-calendar | `src/modules/medical-calendar/{calendar.service.ts, ical.ts, medical-calendar.controller.ts, medical-calendar.module.ts}` |
| wiring | `src/app.module.ts` |
| e2e | `test/transverse.e2e-spec.ts` |

---

## Task 1: reminders + shared-access (+ Mailer)

**Files:** `src/modules/reminders/*`, `src/modules/shared-access/*`, `src/mail/mailer.ts`, `src/mail/console.mailer.ts`; Modify `src/app.module.ts`

- [ ] **Step 1: Étendre Mailer** — dans `src/mail/mailer.ts`, ajouter à l'interface :
```ts
  sendCalendarInvitation(to: string, senderName: string, calendarToken: string): Promise<void>;
```
Dans `src/mail/console.mailer.ts`, injecter `ConfigService` et implémenter :
```ts
  async sendCalendarInvitation(to: string, senderName: string, calendarToken: string): Promise<void> {
    const url = `${this.config.get('APP_URL', { infer: true })}/api/medical/calendar/${calendarToken}`;
    this.logger.log(`[calendar-invite] ${to} (de ${senderName}) → ${url}`);
    console.log(`[calendar-invite] ${to} → ${url}`);
  }
```
Ajouter le constructeur `constructor(private readonly config: ConfigService<Env, true>) {}` (importer `ConfigService` + `type Env`). Vérifier que `pnpm test` (spec ConsoleMailer existante) passe encore — adapter la spec si le constructeur change (instancier `new ConsoleMailer(fakeConfig)` où `fakeConfig = { get: () => 'http://localhost:3001' }`).

- [ ] **Step 2: reminders** — DTO `createReminderSchema` (port validation.ts) : `type z.enum(['email','ical'])`, `target z.enum(['medication','appointment'])`, `medicationId z.string().uuid().optional()`, `appointmentId z.string().uuid().optional()`, `recipientEmail z.string().email()`, `enabled z.boolean().optional()`. Service `extends OwnedCrudService<Reminder>` (table `reminders`) + :
```ts
  async toggle(userId: string, id: string) {
    const current = await this.getOne(userId, id);
    if (!current) return undefined;
    return this.update(userId, id, { enabled: !(current as Reminder).enabled });
  }
```
Controller (plaintext, PAS de dual mode) : `GET /`, `GET /:id` (404), `POST /` (parseBody createReminderSchema → values {type,target,medicationId??null,appointmentId??null,recipientEmail,enabled??true}, 201), `PUT /:id` (strip id/userId, update, 404), `@UseGuards(CsrfGuard) PATCH /:id/toggle` (→ toggle, 404), `DELETE /:id` (204). Guards Jwt class-level + Csrf sur mutations. Module `imports:[AuthModule]`, add to app.module.ts.

- [ ] **Step 3: shared-access** — DTO `createSharedAccessSchema = z.object({ invitedEmail: z.string().email() })`. Service :
```ts
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { sharedAccess, users } from '../../db/schema';
import { MAILER, type Mailer } from '../../mail/mailer';

type SharedAccess = typeof sharedAccess.$inferSelect;

@Injectable()
export class SharedAccessService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(MAILER) private readonly mailer: Mailer,
  ) {}

  list(userId: string): Promise<SharedAccess[]> {
    return this.db.select().from(sharedAccess).where(eq(sharedAccess.userId, userId)).limit(100);
  }

  async create(userId: string, invitedEmail: string): Promise<SharedAccess> {
    const calendarToken = randomUUID().replace(/-/g, '').slice(0, 32);
    const [row] = await this.db.insert(sharedAccess).values({ userId, invitedEmail, calendarToken }).returning();
    const [user] = await this.db.select({ displayName: users.displayName, email: users.email })
      .from(users).where(eq(users.id, userId)).limit(1);
    const senderName = user?.displayName ?? user?.email ?? 'Un utilisateur DashFlow';
    void this.mailer.sendCalendarInvitation(invitedEmail, senderName, calendarToken).catch(() => undefined);
    return row;
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.db.delete(sharedAccess).where(and(eq(sharedAccess.id, id), eq(sharedAccess.userId, userId)));
  }
}
```
Controller : `@UseGuards(JwtAuthGuard) @Controller('shared-access')` ; `GET /` → list ; `@UseGuards(CsrfGuard) POST /` (201) → parseBody → `create(u.id, invitedEmail)` ; `@UseGuards(CsrfGuard) DELETE /:id` (204) → remove. Module `imports:[AuthModule]`, add to app.module.ts.

- [ ] **Step 4: Unit tests** : `reminders.service.spec.ts` (toggle inverse enabled — mock getOne/update) ; `shared-access.service.spec.ts` (create génère token + appelle sendCalendarInvitation — db + mailer mockés). Run `pnpm test` → vert. `pnpm tsc --noEmit` clean.

- [ ] **Step 5: Commit** — `feat(b5c): reminders (toggle) + shared-access (token+invite) + Mailer.sendCalendarInvitation`

---

## Task 2: medical-calendar (iCal public)

**Files:** `src/modules/medical-calendar/{ical.ts, calendar.service.ts, medical-calendar.controller.ts, medical-calendar.module.ts}`; Modify `src/app.module.ts`. **Source : `medical-calendar.routes.ts`.**

- [ ] **Step 1: iCal builder (TDD)** `src/modules/medical-calendar/ical.ts` :
```ts
export function escapeIcal(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export interface IcalAppointment { id: string; date: string; time: string; practitionerId: string; reason: string | null; outcome: string | null; status: string }
export interface IcalMedication { id: string; name: string; dosage: string; quantity: number; dailyRate: string; startDate: string }

export function buildIcal(
  appointments: IcalAppointment[],
  practitioners: { id: string; name: string }[],
  medications: IcalMedication[],
): string {
  const practMap = new Map(practitioners.map((p) => [p.id, p.name]));
  const lines: string[] = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DashFlow//Medical Calendar//FR',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:DashFlow Medical',
  ];
  for (const apt of appointments) {
    const dateStr = apt.date.replace(/-/g, '');
    const timeStr = apt.time.replace(':', '') + '00';
    const practName = practMap.get(apt.practitionerId) ?? 'Praticien';
    const summary = apt.reason ? `${practName} - ${apt.reason}` : practName;
    lines.push('BEGIN:VEVENT', `DTSTART:${dateStr}T${timeStr}`, `SUMMARY:${escapeIcal(summary)}`, `UID:apt-${apt.id}@dashflow`);
    if (apt.outcome) lines.push(`DESCRIPTION:${escapeIcal(apt.outcome)}`);
    lines.push(`STATUS:${apt.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`, 'END:VEVENT');
  }
  for (const med of medications) {
    const dailyRate = Number(med.dailyRate);
    if (dailyRate <= 0) continue;
    const daysRemaining = med.quantity / dailyRate;
    const refill = new Date(med.startDate);
    refill.setDate(refill.getDate() + Math.floor(daysRemaining));
    const refillStr = refill.toISOString().slice(0, 10).replace(/-/g, '');
    lines.push('BEGIN:VEVENT', `DTSTART;VALUE=DATE:${refillStr}`, `SUMMARY:${escapeIcal(`Renouveler: ${med.name}`)}`,
      `UID:med-${med.id}@dashflow`, `DESCRIPTION:${escapeIcal(`${med.dosage} - ${med.quantity} restants`)}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
```
Test `src/modules/medical-calendar/ical.spec.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { buildIcal, escapeIcal } from './ical';

describe('iCal', () => {
  it('escapeIcal échappe ; , \\ \\n', () => {
    expect(escapeIcal('a;b,c')).toBe('a\\;b\\,c');
  });
  it('buildIcal génère VCALENDAR + VEVENT appointment', () => {
    const ical = buildIcal(
      [{ id: 'a1', date: '2026-06-01', time: '10:00', practitionerId: 'p1', reason: 'Visite', outcome: null, status: 'scheduled' }],
      [{ id: 'p1', name: 'Dr X' }], [],
    );
    expect(ical).toContain('BEGIN:VCALENDAR');
    expect(ical).toContain('DTSTART:20260601T100000');
    expect(ical).toContain('SUMMARY:Dr X - Visite');
    expect(ical).toContain('UID:apt-a1@dashflow');
    expect(ical.endsWith('END:VCALENDAR')).toBe(true);
  });
});
```
Run → FAIL puis PASS.

- [ ] **Step 2: CalendarService** `calendar.service.ts` :
```ts
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { sharedAccess, appointments, practitioners, medications } from '../../db/schema';
import { buildIcal } from './ical';

@Injectable()
export class CalendarService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async feed(token: string): Promise<string | null> {
    const [access] = await this.db.select().from(sharedAccess).where(eq(sharedAccess.calendarToken, token)).limit(1);
    if (!access) return null;
    const userId = access.userId;
    const [apts, practs, meds] = await Promise.all([
      this.db.select().from(appointments).where(eq(appointments.userId, userId)).limit(500),
      this.db.select().from(practitioners).where(eq(practitioners.userId, userId)).limit(500),
      this.db.select().from(medications).where(eq(medications.userId, userId)).limit(500),
    ]);
    return buildIcal(apts as never, practs as never, meds as never);
  }
}
```

- [ ] **Step 3: Controller** `medical-calendar.controller.ts` (PUBLIC, pas de guard) :
```ts
import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CalendarService } from './calendar.service';

@Controller('medical/calendar')
export class MedicalCalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get(':token')
  async feed(@Param('token') token: string, @Res() res: Response): Promise<void> {
    const ical = await this.calendar.feed(token);
    if (ical === null) throw new NotFoundException('Token invalide');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="medical.ics"');
    res.send(ical);
  }
}
```
Module `medical-calendar.module.ts` (PAS d'`imports:[AuthModule]` — public) : controllers:[MedicalCalendarController], providers:[CalendarService]. Add to app.module.ts.

- [ ] **Step 4:** `pnpm test` + `pnpm tsc --noEmit`. Boot smoke : route `/api/medical/calendar/:token` mappée (GET, publique) ; tuer serveur + libérer :3001.

- [ ] **Step 5: Commit** — `feat(b5c): medical-calendar (flux iCal public)`

---

## Task 3: e2e transverse

**Files:** Create `test/transverse.e2e-spec.ts`

- [ ] **Step 1:** e2e réutilisant le helper `authedClient` (copier de `test/finance.e2e-spec.ts`). Scénarios :
  - reminders : `POST /api/reminders` `{ type:'email', target:'appointment', recipientEmail:'x@y.com' }` → 201 ; `PATCH /:id/toggle` → `enabled` inversé ; `GET /` contient ; `DELETE` 204.
  - shared-access + calendar public : `POST /api/shared-access` `{ invitedEmail:'a@b.com' }` → 201, capture `calendarToken` du body ; puis **sans cookie** `GET /api/medical/calendar/:token` → 200, `Content-Type` contient `text/calendar`, body contient `BEGIN:VCALENDAR`.
  - calendar token inconnu : `GET /api/medical/calendar/inexistant` → 404.
```ts
// réutiliser beforeAll + authedClient de finance.e2e-spec.ts (CapturingMailer/app init).
```

- [ ] **Step 2:** `pnpm test:e2e` → tous verts (auth + oauth + finance + medical + transverse). **Step 3: Commit** — `test(b5c): e2e reminders + shared-access + calendar public`

---

## Self-Review

**Couverture du spec :**
- reminders CRUD plaintext + toggle → Task 1 ✓
- shared-access list/create(token+invite)/delete + Mailer.sendCalendarInvitation → Task 1 ✓
- medical-calendar public iCal (builder exact + escapeIcal + 404) → Task 2 ✓
- e2e reminders/shared-access/calendar public + 404 → Task 3 ✓
- pas de cron (hors-périmètre) ✓

**Placeholders :** iCal builder + CalendarService + controllers entièrement inlinés ; reminders/shared-access décrits par contrat + champs + template B5a. Pas de TODO.

**Cohérence des types :** `OwnedCrudService` (reminders) ; `Mailer.sendCalendarInvitation` ajouté à l'interface ET à ConsoleMailer (sinon DI casse) ; `MAILER` token injecté dans shared-access ; medical-calendar PUBLIC (pas d'AuthModule) cohérent avec le besoin (pas de guard) ; `buildIcal` signature cohérente service↔test.
