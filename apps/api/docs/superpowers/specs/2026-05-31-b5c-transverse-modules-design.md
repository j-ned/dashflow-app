# Phase B5c — Modules data Transverses (NestJS)

**Date :** 2026-05-31
**Repo :** `nest-dashflow-app`
**Statut :** approuvé, prêt pour plan d'implémentation
**Dépend de :** B5a (base `OwnedCrudService`, `parseBody`), B1 (Mailer, guards)

## Contexte

Dernier lot des modules data : reminders, shared-access, medical-calendar (flux iCal
public). Port fidèle de Hono. Backend-only. Schéma déjà porté (B0).

## Modules

### reminders (`/api/reminders`)
- CRUD **plaintext** (pas d'`encryptedData`) sur la base `OwnedCrudService<Reminder>`
  (table `reminders`) + `GET /:id` + `PATCH /:id/toggle`.
- Champs (createReminderSchema) : `type` ('email'|'ical'), `target`
  ('medication'|'appointment'), `medicationId?`, `appointmentId?`, `recipientEmail`,
  `enabled?` (défaut true).
- `PATCH /:id/toggle` : lit `enabled` (404 si absent), écrit l'inverse.
- **Pas de cron d'envoi** (inexistant côté Hono).

### shared-access (`/api/shared-access`)
- `GET /` (list par userId), `POST /` (génère `calendarToken` = 32 hex via
  `crypto.randomUUID().replace(/-/g,'').slice(0,32)`, insert, puis envoi **non-bloquant**
  `mailer.sendCalendarInvitation(invitedEmail, senderName, token)` — `senderName` =
  displayName ?? email du user), `DELETE /:id`. Pas de PUT/GET-by-id.
- **Extension `Mailer`** : ajouter `sendCalendarInvitation(to, senderName, token)` à
  l'interface (`src/mail/mailer.ts`) + impl `ConsoleMailer` (logge l'URL
  `${APP_URL}/api/medical/calendar/${token}`). Lit `APP_URL` via ConfigService.

### medical-calendar (`/api/medical/calendar/:token`, **PUBLIC**)
- Aucun guard (route publique), aucun CSRF (GET). Throttler global s'applique.
- `CalendarService.feed(token)` : lookup `sharedAccess.calendarToken` → 404 si absent ;
  agrège `appointments`, `practitioners`, `medications` du `userId` du token (Promise.all,
  limit 500) ; **iCal builder** port exact :
  - 1 VEVENT par appointment (DTSTART date+time, SUMMARY `practName - reason`, UID
    `apt-<id>@dashflow`, DESCRIPTION = outcome, STATUS CONFIRMED/CANCELLED).
  - 1 VEVENT par medication (DTSTART;VALUE=DATE = startDate + floor(quantity/dailyRate)
    jours, SUMMARY `Renouveler: <name>`, UID `med-<id>@dashflow`, DESCRIPTION
    `<dosage> - <quantity> restants`) ; skip si dailyRate ≤ 0.
  - `escapeIcal` (échappe `\ ; , \n`).
- Controller renvoie le texte iCal avec `Content-Type: text/calendar; charset=utf-8` +
  `Content-Disposition: inline; filename="medical.ics"` (via `@Res()` ou `@Header()`).

## Détails

- Le calendrier lit les **colonnes claires** (date/time/status/reason/outcome,
  name/dosage/quantity). Si les données sont chiffrées (encryptedData), le flux est
  limité — comportement Hono conservé (pas de déchiffrement serveur, impossible : E2EE).
- `medical-calendar` est un module séparé monté en public ; les autres sous `/api`
  (guards via `@UseGuards` par contrôleur, comme B5a/b).

## Tests & critères de succès

**Tests** :
- Unit `reminders` : `toggle` inverse `enabled` (404 si absent).
- Unit `shared-access` : POST génère un token + appelle `sendCalendarInvitation`
  (mailer mocké).
- Unit `CalendarService` : génère un VCALENDAR avec VEVENT depuis appointments/medications
  mockés ; 404 si token inconnu ; `escapeIcal` échappe.
- e2e : reminders CRUD + toggle (authentifié) ; shared-access POST → token, puis
  `GET /api/medical/calendar/:token` **sans auth** → 200 `text/calendar` contenant
  `BEGIN:VCALENDAR`.

**Critères** :
1. reminders : CRUD + toggle, ownership userId.
2. shared-access : POST crée le token + déclenche l'email (console) ; DELETE ; list.
3. medical-calendar : public, token valide → iCal 200 ; token inconnu → 404.
4. Mailer étendu (`sendCalendarInvitation`) sans casser l'existant.
5. Tous les tests verts ; aucune régression B1-B5b.

## Hors-périmètre

- Cron d'envoi de rappels (inexistant Hono), uploads, demo, B-final.
