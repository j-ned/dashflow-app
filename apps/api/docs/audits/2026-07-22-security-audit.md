# Audit de sécurité — nest-dashflow-app

Déclenché le 2026-07-22, lecture seule. Repo propre sur `master`, à jour avec `origin/master`, dernier commit
`001cf6e` (Sentry backend, committé et poussé). Frontend (`ng-dashflow-app`) hors scope, audité séparément.

## Findings

### 1. [Élevée] Validation d'entrée absente sur la quasi-totalité des routes UPDATE

Sur 13 des 14 modules CRUD, la branche `update` transmet le body brut du client (moins `id`/`userId`/
`createdAt`) directement à `.set()` Drizzle, sans schema Zod — contrairement à `create`, toujours validé.

- `src/modules/documents/documents.controller.ts:71-84`
- Même pattern : `envelopes.controller.ts:64-76`, `medications.controller.ts:65-79`,
  `account-transactions.controller.ts:129-149`, `loans.controller.ts:68-81`, `appointments.controller.ts:59-73`,
  `prescriptions.controller.ts:68-84`, `reminders.controller.ts:40-45`
- Variante via helper partagé `src/common/crud/exclude-system-fields.ts` : `bank-accounts.controller.ts:68-70`,
  `patients.controller.ts:39-43`, `practitioners.controller.ts:40-46`, `salary-archives.controller.ts:72-83`,
  `recurring-entries.controller.ts:78-91`
- Seul `src/modules/members/members.controller.ts:60-79` valide correctement (`parseBody(updateMemberSchema, body)`).

**Scénario concret** : un utilisateur authentifié envoie `PUT /documents/:id` avec
`{ patientId: "<uuid d'un patient d'un autre foyer>" }`. Aucun service ne vérifie que la FK référencée
(`patientId`/`practitionerId`/`accountId`/`memberId`) appartient à l'utilisateur courant — seule la ligne
elle-même est filtrée par `userId`. Un utilisateur peut lier sa ressource à celle d'un autre (référence
croisée non autorisée), et une suppression côté victime provoquera un `ON DELETE CASCADE` inattendu chez
l'attaquant. Contournement de validation métier (enums, longueurs, formats).

**Recommandation** : schema Zod systématique sur `toUpdatePatch` (whitelist explicite), vérifier l'appartenance
des FK référencées avant `create`/`update` dans chaque service.

### 2. [Élevée] E2EE optionnel, pas imposé — données santé/budget en clair par défaut

`users.encryptionVersion` (`src/db/schema/auth.ts:24`) vaut `0` par défaut. Tant que l'utilisateur n'a pas
migré (`POST /auth/me/encryption-keys` + `EncryptionService.migrate`), toutes les colonnes métier restent en
clair (`patients.*`, `medications.*`, `bank_accounts.name`, `envelopes.balance`, `loans.amount`, `documents.title`...).
État transitoire assumé (migration progressive), mais le principe produit n'est vrai qu'après opt-in explicite.

**Recommandation** : imposer le chiffrement dès l'inscription, ou documenter/alerter explicitement tant que
`encryptionVersion=0`.

### 3. [Moyenne] Upload de fichiers médicaux/payslips sans validation MIME ni magic-bytes

Seul l'avatar (`auth.controller.ts:301-307`) filtre le `mimetype`. Sans validation :
`documents.controller.ts:96-111`, `prescriptions.controller.ts:99-113`, `salary-archives.controller.ts:116-132`,
`recurring-entries.controller.ts:95-111`. Le `mimetype` déclaratif client est stocké puis resservi tel quel
(`res.setHeader('Content-Type', obj.contentType)`, sans `Content-Disposition: attachment`).

**Recommandation** : whitelist stricte (PDF/images) + vérification magic-bytes (`file-type`),
`Content-Disposition: attachment` sur les téléchargements.

### 4. [Moyenne] `GET /auth/avatar/:userId` public, sans authentification

`src/auth/auth.controller.ts:319-330` — pas de `@UseGuards(JwtAuthGuard)`. Exploitabilité limitée par
l'entropie UUID v4, mais aucun garde-fou (pas de rate limit dédié). À confirmer/documenter comme choix assumé.

### 5. [Moyenne] Rate limiting probablement inefficace derrière le reverse-proxy

`src/main.ts` ne configure jamais `app.set('trust proxy', ...)`. Déploiement Docker Swarm + Traefik → `req.ip`
renvoie l'IP du proxy pour toutes les requêtes → `@nestjs/throttler` (clé par défaut = IP) bucketise tout le
trafic sous une seule clé. `STRICT_THROTTLE` (10 req/15 min, `src/auth/throttle.ts`) deviendrait un quota
global partagé : 10 tentatives de connexion échouées par n'importe qui bloqueraient toute la famille (DoS
auto-infligé), et un attaquant distant ne serait limité qu'à la même enveloppe globale.

**Recommandation** : `app.set('trust proxy', 1)` + vérifier que Traefik écrase bien `X-Forwarded-For`.

### 6. [Moyenne] Migration non idempotente — rupture de la convention `DROP ... IF EXISTS`

`src/db/migrations/0006_drop_monetisation.sql:1-2` — pas de `IF EXISTS`, contrairement à la convention connue
du projet (incident déjà vécu : migration non idempotente rejouée → crash-loop boot → 502). Si rejouée sur un
environnement où les tables sont déjà absentes, `scripts/db/migrate.mjs` échoue et le conteneur crash-loop.

**Recommandation** : `DROP TABLE IF EXISTS ... CASCADE;`.

### 7. [Moyenne] Codes OTP à 6 chiffres non cloisonnés par "purpose"

`verification_codes` (`src/db/schema/auth.ts:35-43`) n'a pas de colonne "purpose". `findValidCode`
(`auth.repository.ts:80-96`) ne vérifie que `email + code + expiresAt`. Un code émis pour la vérification
d'email pourrait être accepté par `reset-password`. Exploitabilité faible (nécessite déjà l'accès à la boîte
mail).

**Recommandation** : colonne `purpose` + vérification dans `findValidCode`.

### 8. [Moyenne] Aucune séparation de rôle Postgres applicatif

`src/db/drizzle.module.ts` ouvre une connexion unique via `DATABASE_URL`, aucun rôle `NOSUPERUSER`/
`NOBYPASSRLS` ni RLS. Combiné au finding #1, toute l'autorisation repose sur la discipline applicative
(`WHERE user_id = ...`), sans filet DB.

### 9. [Faible] Dépendances vulnérables (`pnpm audit --prod`)

| Sévérité | Paquet | CVE | Exploitable ici ? |
|---|---|---|---|
| High | `drizzle-orm <0.45.2` | GHSA-gpj5-g38j-94v9 | Non — `sql.identifier()` (`demo.service.ts`) sur noms de table constants uniquement. |
| High | `multer <2.2.0` | GHSA-72gw-mp4g-v24j | Oui potentiellement — tous les `FileInterceptor` exposés à un client authentifié. |
| Moderate | `multer <2.2.0` | GHSA-3p4h-7m6x-2hcm | Idem. |
| High | `nodemailer <=9.0.0` | GHSA-p6gq-j5cr-w38f | Non — option `raw` jamais utilisée. |
| Low | `body-parser <2.3.0` | GHSA-v422-hmwv-36x6 | Impact mineur. |

**Recommandation** : `pnpm up drizzle-orm@^0.45.2`, forcer `multer@^2.2.0`, mettre à jour `nodemailer`.

### 10. [Faible] `.env.example` référence encore Stripe

Résidu cosmétique post-retrait de la monétisation, aucun risque direct.

## Faux positifs écartés

- CSRF absent sur register/login/verify/forgot-password/reset-password/demo-login : normal, ces routes créent
  la session elles-mêmes, hors modèle de menace CSRF. Routes mutantes authentifiées ont bien `CsrfGuard`.
- Anti-énumération, anti-timing, `genCode` crypto, suppression de compte IDOR-safe : vérifiés présents et cohérents.
- Injection SQL : aucune trouvée, tout paramétré ou `sql.identifier()` sur noms constants.
- Secret JWT : chargé depuis env, validé `min(32)` Zod, jamais en dur.
- CORS : whitelist stricte via `CORS_ORIGIN`, cohérent avec cookies httpOnly.
- Headers de sécurité : `helmet()` actif, `crossOriginResourcePolicy: cross-origin` volontaire (avatar cross-origin).

## Synthèse

Socle auth solide (JWT + cookie httpOnly, CSRF double-submit, argon2, anti-timing/énumération, 2FA TOTP, OAuth
PKCE), correctifs connus bien en place. Risque le plus concret : finding #1 (validation manquante sur UPDATE +
absence de vérification d'appartenance des FK), combiné à l'absence de séparation de rôle DB (#8) — toute
l'autorisation repose sur des filtres `userId` posés à la main, sans filet. Second risque structurel : E2EE
opt-in (#2), données en clair par défaut côté serveur. Prioriser #1 et la migration non idempotente (#6,
risque d'incident déjà vécu) avant tout.
