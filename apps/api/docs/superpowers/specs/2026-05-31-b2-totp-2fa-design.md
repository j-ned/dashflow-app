# Phase B2 — TOTP 2FA (NestJS)

**Date :** 2026-05-31
**Repo :** `nest-dashflow-app`
**Statut :** approuvé, prêt pour plan d'implémentation
**Dépend de :** B1 (auth core)

## Contexte

Ajout de l'authentification à deux facteurs (TOTP) au module auth NestJS, **port
fidèle** du comportement Hono existant. Backend-only (big-bang) ; le front n'est pas
touché. Colonnes déjà présentes dans le schéma (B0) : `totpSecret` (text, base32),
`totpEnabled` (timestamp, null = désactivé).

## Décision de cadrage

- **Port fidèle Hono** : pas de backup codes (reporté), pas de chiffrement du secret
  au repos (reporté). Secret stocké **en clair base32**, comme aujourd'hui — wire-
  compatible avec d'éventuels secrets déjà en base.

## Architecture (module `auth`)

- **`TwoFactorService`** (`src/auth/two-factor.service.ts`) — wrappe `otpauth` + `qrcode` :
  - `generateSecret(email): { secret: string; otpauthUri: string }` — issuer "DashFlow", label = email.
  - `buildQrDataUrl(otpauthUri): Promise<string>` — data URL via `qrcode`.
  - `verify(secret: string, code: string): boolean` — `OTPAuth.TOTP.validate({ token, window: 1 })` (±30 s).
- **`AuthService`** (méthodes ajoutées) :
  - `setupTotp(userId)` → génère secret, le stocke (`totpSecret`), **n'active pas**, renvoie `{ qrCode, secret, uri }`.
  - `enableTotp(userId, code)` → vérifie le code vs `totpSecret` stocké ; si OK set `totpEnabled = now`.
  - `disableTotp(userId, password)` → vérifie le mot de passe (argon2) ; si OK efface `totpSecret` + `totpEnabled`.
  - `login` (modifié) → accepte `totpCode?` ; si `totpEnabled` && `totpSecret` : code manquant → fail 403 **code `TOTP_REQUIRED`**, invalide → fail 401, sinon poursuit.
- **`Result`** étendu : `fail(status, error, code?)` avec un champ optionnel `code`
  (machine-readable). `httpFrom` renvoie alors un body `{ message, code }`.

## Endpoints (auth + CSRF)

| Méthode | Route | Body | Rôle |
|---|---|---|---|
| POST | `/auth/me/2fa/setup` | — | génère secret + QR (non activé) |
| POST | `/auth/me/2fa/verify` | `{ code }` | active la 2FA si code valide |
| POST | `/auth/me/2fa/disable` | `{ password }` | désactive (mot de passe requis) |

Tous sous `@UseGuards(JwtAuthGuard, CsrfGuard)`. Le `loginSchema` (B1) regagne
`totpCode: z.string().length(6).optional()`.

## DTOs

- `totpVerifySchema = z.object({ code: z.string().length(6) })`
- `totpDisableSchema = z.object({ password: z.string().min(1) })`
- `loginSchema` (modif) : ajout `totpCode: z.string().length(6).optional()`.

## Dépendances

`otpauth`, `qrcode`, `@types/qrcode` (dev).

## Erreurs

- Login 2FA sans code → **403** body `{ message, code: 'TOTP_REQUIRED' }`.
- Login code invalide → 401. Disable mauvais mot de passe → 401. Code verify invalide → 400.

## Tests

- **Unit `TwoFactorService`** : `generateSecret` renvoie un secret base32 + URI ;
  round-trip `verify(secret, code)` avec un code calculé depuis le secret → true ;
  code faux → false.
- **Unit `AuthService` 2FA** : `enableTotp` code valide → `totpEnabled` set ; code
  invalide → fail ; `disableTotp` mauvais mot de passe → fail 401 ; `login` gate
  (totpEnabled sans code → 403 `TOTP_REQUIRED` ; avec bon code → ok).
- **e2e** : enrôler (setup → verify avec code calculé via `otpauth`) puis `login`
  sans code → 403 `TOTP_REQUIRED`, avec code → 200 + cookie.

## Critères de succès

1. `setup` renvoie `{ qrCode (data URL), secret, uri }` et stocke le secret sans activer.
2. `verify` avec un code TOTP valide active la 2FA (`totpEnabled` non null).
3. `login` d'un compte 2FA sans `totpCode` → 403 `TOTP_REQUIRED` ; avec bon code → cookie posé.
4. `disable` exige le bon mot de passe (sinon 401) et efface secret + activation.
5. Tous les tests verts ; aucune régression sur les tests B1.

## Hors-périmètre (reporté)

- Backup / recovery codes.
- Chiffrement du secret TOTP au repos.
- Désactivation pour comptes sans mot de passe (OAuth/passphrase) — nécessiterait
  `set-password` au préalable (comportement Hono conservé : disable exige password).
