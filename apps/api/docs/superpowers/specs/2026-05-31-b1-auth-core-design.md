# Phase B1 — Auth core (NestJS)

**Date :** 2026-05-31
**Repo :** `nest-dashflow-app`
**Statut :** approuvé, prêt pour plan d'implémentation
**Dépend de :** B0 (fondation NestJS)

## Contexte

Réimplémentation en NestJS du cœur d'authentification de DashFlow (aujourd'hui en
Hono). Migration **big-bang** : B1 est **backend-only**, testé en isolation
(curl/supertest/intégration). Le front Angular n'est PAS touché (il parle encore à
Hono en prod et en dev jusqu'au cutover B-final). Aucune régression prod possible.

Changement majeur vs Hono : le JWT n'est plus renvoyé dans le body — il vit dans un
**cookie httpOnly**, avec protection **CSRF double-submit**.

## Décisions de cadrage

- **Token** : JWT **unique** (~7j, HS256, `@nestjs/jwt`) dans un cookie httpOnly.
  Pas d'access/refresh pour démarrer (ajout possible plus tard sans casser le contrat).
- **CSRF** : pattern **double-submit** dès B1 (cookie CSRF lisible + en-tête
  `X-CSRF-Token` vérifié sur les mutations).
- **Mailer** : interface injectable + impl **console** en dev (logge le code). SMTP
  registrar branché plus tard via la même interface.
- **E2EE** : seul le **couplage côté mots de passe** est en B1 (re-wrap requis si
  `encryptionVersion=1`). Les endpoints de setup E2EE restent en B3.

## Module & endpoints

Module `src/modules/auth/` (`auth.module.ts`, `auth.controller.ts`, `auth.service.ts`,
`auth.repository.ts`, `dto/`). Repository `users` partagé (réutilisable par les
modules data en B5+). Tout sous le préfixe `/api/auth` (parité Hono).

| Méthode | Route | Rôle | Accès |
|---|---|---|---|
| POST | `/auth/register` | crée user *pending* + envoie code | public, rate-limited |
| POST | `/auth/verify` | valide code email → pose cookie (auto-login) | public, rate-limited |
| POST | `/auth/resend-code` | renvoie un code | public, rate-limited |
| POST | `/auth/login` | email+password → pose cookie | public, rate-limited |
| POST | `/auth/logout` | efface le cookie | auth |
| POST | `/auth/forgot-password` | envoie code reset (réponse générique) | public, rate-limited |
| POST | `/auth/reset-password` | code + nouveau mot de passe (+ re-wrap E2EE optionnel) | public, rate-limited |
| GET | `/auth/me` | user courant (+ keyMaterial) | auth |
| PATCH | `/auth/me` | update `displayName` | auth |
| PATCH | `/auth/me/password` | change password (current + new, + re-wrap E2EE optionnel) | auth |
| POST | `/auth/me/set-password` | définir password (compte sans password, + re-wrap) | auth |
| GET | `/auth/csrf` | délivre le token CSRF (double-submit) | public |

## Mécanique session + CSRF

- **JWT** : `@nestjs/jwt`, HS256, payload `{ sub: userId, email }`, exp 7j. `JWT_SECRET`
  ajouté au schéma env (validé ≥32 chars au boot).
- **Cookie de session** : `httpOnly`, `Secure` (prod), `SameSite` (Lax dev / None prod),
  `Path=/`, `maxAge` 7j. Flags dérivés de `NODE_ENV`.
- **`JwtAuthGuard`** (`common/guards/`) : lit le cookie de session, vérifie le JWT,
  attache `request.user` (id + email). 401 si absent/invalide.
- **`@CurrentUser()`** : `createParamDecorator` injectant l'utilisateur courant.
- **CSRF double-submit** : `GET /auth/csrf` pose un cookie CSRF (non-httpOnly, lisible
  JS) et renvoie le token. **`CsrfGuard`** exige l'en-tête `X-CSRF-Token` == cookie sur
  toute mutation (POST/PATCH/DELETE). Lib `csrf-csrf` ou impl maison (~30 lignes).
- **Réponses** : body `{ user, keyMaterial }` — **jamais** le token (il est dans le
  cookie). `keyMaterial = { salt, wrappedMasterKey, recoveryWrappedKey } | null`.
  DTO de sortie explicite : jamais `password`/`totpSecret`/colonnes brutes.

## Flows & couplage E2EE

- **Codes** : table `verification_codes` (6 chiffres, exp 10 min). `register` → user
  `emailVerified=null` + hash argon2id + envoi code. `verify` → vérifie code valide &
  non expiré, set `emailVerified`, purge codes, pose cookie. `resend-code` → régénère
  si non vérifié.
- **forgot/reset** : `forgot-password` → message **générique** (anti-énumération),
  envoie un code si compte existant & vérifié. `reset-password` → vérifie code, met à
  jour le hash.
- **Couplage E2EE (contrat repris de Hono)** : `me/password`, `me/set-password`,
  `reset-password` acceptent `newSalt?` + `newWrappedMasterKey?`. Si
  `encryptionVersion === 1` et champs absents → **400 « re-wrap de la clé requis »**.
  Si fournis, mise à jour des clés pendant le changement de mot de passe.
- **login** : email vérifié + verify argon2 → pose cookie. **TOTP non géré en B1**
  (gate `TOTP_REQUIRED` ajouté en B2 avant le cutover).

## Mailer

- Interface DI `Mailer` : `sendVerificationCode(to, code)`, `sendPasswordResetCode(to, code)`.
- **`ConsoleMailer`** (dev) : logge destinataire + code (permet curl-test des flows).
- Sélection par config (`MAILER=console|smtp`, défaut console). SMTP registrar
  (nodemailer) + templates portés depuis Hono : étape ultérieure.

## Sécurité & erreurs

- **Rate limiting** `@nestjs/throttler` : strict sur les routes publiques d'auth
  (~10/15 min : register/login/verify/forgot/reset), permissif sur `/me/*`.
- **argon2id** ; mot de passe min **12** (Zod). Aucune donnée sensible en réponse.
- Erreurs via le filtre global B0 + Result pattern → `Unauthorized`/`Conflict`/
  `BadRequest` au bord. Messages génériques sur login/forgot.

## Tests & critères de succès

**Tests (Vitest)** :
- Unitaire : `AuthService` (argon2 hash/verify, génération/validation code, règle
  re-wrap E2EE, Result), `JwtAuthGuard`, `CsrfGuard`, `ConsoleMailer` — deps mockées.
- Intégration/e2e (supertest + DB locale) : `register → code (ConsoleMailer) → verify
  → cookie → GET /me 200` ; `login` mauvais mdp → 401 ; mutation sans CSRF → 403 ;
  `logout` → cookie effacé.

**Critères de succès** :
1. register→verify→login pose un cookie httpOnly ; `GET /api/auth/me` renvoie l'user.
2. Mutation sans `X-CSRF-Token` valide → 403 ; avec → OK.
3. `login` mauvais mdp → 401 ; `forgot-password` compte inexistant → 200 générique.
4. Changement de mot de passe d'un compte `encryptionVersion=1` sans re-wrap → 400.
5. Aucune donnée sensible (password/secret/clés) dans les réponses.
6. Tous les tests verts ; prod Hono intacte.

## Hors-périmètre (reporté)

- **TOTP au login** → B2.
- **E2EE setup/migrate/wipe** (`/me/encryption-keys`, `/me/encryption-passphrase`,
  `/me/migrate-encryption`, `/me/wipe-encryption`, `/reset-password-with-recovery`) → B3.
- **OAuth Google** → B4.
- **Avatar upload** (S3→R2) → étape dédiée.
- **Demo-login / demo-reset** → étape démo dédiée.
- **Durcissement cookie prod cross-site** (SameSite=None/Secure, domaines `app.*`/
  `api.*`, CSRF côté front) → revu au cutover **B-final**.
