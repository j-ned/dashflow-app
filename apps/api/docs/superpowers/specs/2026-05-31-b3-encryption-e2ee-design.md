# Phase B3 — Chiffrement E2EE (NestJS)

**Date :** 2026-05-31
**Repo :** `nest-dashflow-app`
**Statut :** approuvé, prêt pour plan d'implémentation
**Dépend de :** B1 (auth core), B2 (TOTP)

## Contexte

Port des endpoints de chiffrement E2EE de Hono. Le chiffrement est **client-side** :
le serveur ne stocke que des clés wrappées (`encryptionSalt`, `wrappedMasterKey`,
`recoveryWrappedKey`), un flag `encryptionPassphrase`, `encryptionVersion`, et des
blobs `encryptedData` par ligne. Le serveur ne voit **jamais** la clé maître ni le
plaintext. Contrat **wire-compatible** avec le client Angular existant — ne pas
changer le schéma de ces champs. Colonnes déjà présentes (B0).

Backend-only (big-bang). On implémente **toute** la feature en B3, y compris
`migrate`/`wipe` qui touchent 13 tables data via le schéma Drizzle déjà porté (les
modules métier B5+ n'existent pas encore, mais le schéma suffit pour les bulk ops).

## Architecture

- **`EncryptionService`** (`src/auth/encryption.service.ts`) : injecte `AuthRepository`
  (updates user + validation de code via `findValidCode`/`deleteCodes`) et `DRIZZLE`
  (bulk migrate/wipe). Méthodes : `setKeys`, `setPassphrase`, `migrate`, `wipe`,
  `resetPasswordWithRecovery`.
- **`encryption.controller.ts`** (module auth, routes sous `/auth`) : 5 endpoints.
  `/me/*` sous `JwtAuthGuard + CsrfGuard` ; `/reset-password-with-recovery` public +
  `@Throttle(STRICT)`.
- Câblage : `EncryptionService` + `EncryptionController` ajoutés à `AuthModule`.

## Réconciliation du re-wrap (fix écart B1 vs Hono)

En B1, `resetPassword` imposait à tort le re-wrap (400 si `encryptionVersion=1`). Hono
ne l'imposait que sur `/me/password` et `/me/set-password`. Correction en B3 :
- `/reset-password` → **reset simple**, plus d'enforcement. On retire `newSalt`/
  `newWrappedMasterKey` de `resetPasswordSchema` et l'appel `checkRewrap` dans
  `AuthService.resetPassword`. (Flow « oubli **sans** clé de récup », suivi d'un wipe.)
- `/reset-password-with-recovery` → reset + maj **optionnelle** des clés, **sans** 400.
  (Flow « oubli **avec** clé de récup ».)
- `/me/password` & `/me/set-password` → **conservent** l'enforcement re-wrap (correct).

## Endpoints, DTOs

| Méthode | Route | Body | Effet |
|---|---|---|---|
| PATCH | `/auth/me/encryption-keys` | `{salt, wrappedMasterKey, recoveryWrappedKey}` | set les 3 + `encryptionVersion=1` |
| POST | `/auth/me/encryption-passphrase` | `{passphrase}` (≥8) | set `encryptionPassphrase=true` (jamais stockée) |
| POST | `/auth/me/migrate-encryption` | `{keyMaterial:{salt,wrappedMasterKey,recoveryWrappedKey}, data:Record<table, {id, encryptedData}[]>}` | bulk update 13 tables + set clés |
| POST | `/auth/me/wipe-encryption` | — | delete rows des 13 tables (where userId) + reset état |
| POST | `/auth/reset-password-with-recovery` | `{email, code, newPassword, newSalt?, newWrappedMasterKey?}` | reset + maj clés optionnelle |

DTOs Zod (`dto/auth.dto.ts`) :
- `setupEncryptionKeysSchema = z.object({ salt: z.string().min(1), wrappedMasterKey: z.string().min(1), recoveryWrappedKey: z.string().min(1) })`
- `encryptionPassphraseSchema = z.object({ passphrase: z.string().min(8) })`
- `migrateEncryptionSchema = z.object({ keyMaterial: setupEncryptionKeysSchema, data: z.record(z.string(), z.array(z.object({ id: uuid, encryptedData: z.string() }))) })`
- `resetWithRecoverySchema = z.object({ email, code, newPassword, newSalt: z.string().optional(), newWrappedMasterKey: z.string().optional() })`
- `resetPasswordSchema` (modif B1) → retrait de `newSalt`/`newWrappedMasterKey`.

## migrate — détail (port exact Hono)

13 tables : `bankAccounts, envelopes, envelopeTransactions, loans, loanTransactions,
recurringEntries, salaryArchives, patients, practitioners, appointments,
prescriptions, medications, documents`.

Pour chaque ligne reçue : `update(table).set({ encryptedData, ...clearColumns[table] }).where(eq(id, row.id) [AND eq(userId, userId) si la table a userId])`.

`clearColumns` (placeholders, **port exact**) :
- `bankAccounts`: `{ name:'[chiffré]', color:null, dotColor:null }`
- `envelopes`: `{ name:'[chiffré]', type:'épargne', balance:'0', target:null, color:null, dueDay:null }`
- `envelopeTransactions`: `{ amount:'0', date:'1970-01-01' }`
- `loans`: `{ person:'[chiffré]', direction:'lent', amount:'0', remaining:'0', description:null, date:'1970-01-01', dueDate:null, dueDay:null }`
- `loanTransactions`: `{ amount:'0', date:'1970-01-01' }`
- `recurringEntries`: `{ label:'[chiffré]', amount:'0', type:'expense', dayOfMonth:null, date:null, category:null, payslipKey:null }`
- `salaryArchives`: `{ month:'0000-00', salary:'0', totalExpenses:'0', totalSpendings:'0', spendings:[], payslipKey:null }`
- `patients`: `{ firstName:'[chiffré]', lastName:'[chiffré]', birthDate:'1970-01-01', color:null, notes:null }`
- `practitioners`: `{ name:'[chiffré]', type:'autre', phone:null, email:null, address:null, bookingUrl:null }`
- `appointments`: `{ date:'1970-01-01', time:'00:00', status:'scheduled', reason:null, outcome:null }`
- `prescriptions`: `{ issuedDate:'1970-01-01', validUntil:null, documentUrl:null, notes:null }`
- `medications`: `{ name:'[chiffré]', type:'autre', dosage:'[chiffré]', quantity:0, dailyRate:'1', startDate:'1970-01-01', alertDaysBefore:7, skipDays:[] }`
- `documents`: `{ type:'autre', title:'[chiffré]', date:'1970-01-01', fileUrl:null, notes:null }`

Tables sans `userId` (`envelopeTransactions`, `loanTransactions`) → update par `id`
seul (limitation Hono conservée, notée).

## wipe — détail

Delete sur les 11 tables possédant `userId` (where `userId`). Les transactions
(`envelope`/`loan`) partent par cascade FK (parent supprimé). Puis `update(users)` :
`encryptionSalt=null, wrappedMasterKey=null, recoveryWrappedKey=null, encryptionVersion=0`.

## Tests & critères de succès

**Tests** :
- Unit `EncryptionService` (repo mocké) : `setKeys` (3 clés + version=1), `setPassphrase`
  (flag), `resetPasswordWithRecovery` (code valide → re-hash + clés si fournies, invalide → fail).
- Unit `AuthService` (réconciliation) : `resetPassword` compte v=1 sans clés → **succès** ;
  `changePassword`/`setPassword` v=1 sans re-wrap → toujours **400**.
- Intégration (vraie DB) : insère une ligne `bankAccounts`, `migrate` → `encryptedData`
  rempli + `name='[chiffré]'` ; insère puis `wipe` → supprimée + `encryptionVersion=0`.

**Critères** :
1. `encryption-keys` pose les 3 clés + `version=1` ; `GET /me` renvoie `keyMaterial`.
2. `passphrase` pose le flag.
3. `migrate` écrit `encryptedData` + clear colonnes (vérifié ≥1 table) + pose les clés.
4. `wipe` supprime les lignes + reset l'état chiffrement.
5. `reset-password-with-recovery` reset + maj clés ; `/reset-password` ne 400 plus pour v=1.
6. `/me/password` & `/me/set-password` imposent toujours le re-wrap.
7. Tous les tests verts ; aucune régression B1/B2.

## Hors-périmètre

- Avatar upload (S3→R2), OAuth (B4), demo — étapes ultérieures.
- Chiffrement du `recoveryWrappedKey` côté serveur — non (déjà wrappé client-side).
