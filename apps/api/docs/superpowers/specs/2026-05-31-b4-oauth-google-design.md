# Phase B4 — OAuth Google (NestJS)

**Date :** 2026-05-31
**Repo :** `nest-dashflow-app`
**Statut :** approuvé, prêt pour plan d'implémentation
**Dépend de :** B1 (auth core, cookie de session)

## Contexte

Port de l'OAuth Google de Hono (arctic + PKCE), adapté à l'architecture cookie :
le callback **pose le cookie de session httpOnly** au lieu de renvoyer le token dans
l'URL. Backend-only (big-bang). `googleId` déjà dans le schéma (B0).

## Décisions de cadrage

- **Lib** : `arctic` (port fidèle, léger, flow éprouvé). Pas de passport.
- **State PKCE** : `state` + `code_verifier` dans **2 cookies httpOnly courts**
  (10 min, SameSite=Lax) au lieu d'une Map mémoire → stateless, survit restart/multi-instance.
- **Callback** : pose le cookie de session + redirige vers le front **sans token dans
  l'URL** (`${CORS_ORIGIN}/auth/login?oauth=success`).
- **avatarUrl Google** : récupéré mais **non stocké** (comportement Hono conservé).

## Architecture

- **`OAuthService`** (`src/auth/oauth.service.ts`) :
  - `createAuthorization(): { url: string; state: string; codeVerifier: string }` —
    `new Google(clientId, clientSecret, redirectUri)` + `generateState()` +
    `generateCodeVerifier()` + `createAuthorizationURL(state, codeVerifier, ['openid','email','profile'])`.
    Lance si `GOOGLE_CLIENT_ID`/`SECRET` absents.
  - `fetchGoogleUser(code, codeVerifier): Promise<{ googleId; email; displayName }>` —
    `validateAuthorizationCode` → `accessToken()` → `GET https://www.googleapis.com/oauth2/v2/userinfo`.
    Lance si pas d'email.
  - `findOrCreateGoogleUser(profile): Promise<User>` (via `AuthRepository`) :
    1. `findByGoogleId` → renvoie le user ;
    2. sinon `findByEmail` → `updateUser({ googleId, emailVerified: existant ?? now })` (lien) ;
    3. sinon `createUser({ email, displayName, googleId, emailVerified: now })` (sans password).
  - Redirect URI : `${APP_URL}/api/auth/oauth/google/callback`.
- **`OAuthController`** (`src/auth/oauth.controller.ts`, routes `/auth/oauth/google`) :
  - `GET /auth/oauth/google` : `createAuthorization`, pose cookies `dashflow_oauth_state`
    + `dashflow_oauth_verifier` (httpOnly, 600 s, Lax), redirige (302) vers `url`.
    Si non configuré → 503.
  - `GET /auth/oauth/google/callback` : lit `code`/`state` (query) + cookies ; si state
    manquant/mismatch → redirect `?error=oauth_expired` ; `fetchGoogleUser`
    (catch → `?error=oauth_failed`, pas d'email → `?error=oauth_no_email`) ;
    `findOrCreateGoogleUser` ; **pose le cookie de session** (réutilise la logique
    `TokenService.sign` + `sessionCookieOptions`) ; efface les cookies OAuth ; redirige
    `${CORS_ORIGIN}/auth/login?oauth=success`.
- **`AuthRepository`** : ajout `findByGoogleId(googleId)`.
- **Câblage** : `OAuthService` + `OAuthController` dans `AuthModule`. Réutilise
  `TokenService` (déjà fourni).

## Env

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` : **optionnels** (`z.string().optional()`).
  L'app boote sans ; init OAuth → 503 si absents.
- `APP_URL` : `z.string().url().default('http://localhost:3001')`.
- Dep : `arctic`.

## Cookies

- Session : réutilise `SESSION_COOKIE` + `sessionCookieOptions` (B1).
- OAuth transitoires : `dashflow_oauth_state`, `dashflow_oauth_verifier` — httpOnly,
  `secure` (prod), `sameSite: 'lax'` (callback = navigation top-level GET → Lax OK),
  `maxAge: 600_000`, effacés au callback.
- Pas de `CsrfGuard` sur les routes OAuth (GET ; le `state` est la protection CSRF OAuth).

## Tests & critères de succès

**Tests** :
- Unit `OAuthService` : `createAuthorization` → URL `accounts.google.com` + state +
  codeVerifier non vides ; `findOrCreateGoogleUser` (repo mocké) → 3 branches
  (googleId existant → user ; email existant → update lien + emailVerified ; inconnu →
  createUser sans password, emailVerified set).
- e2e : `GET /api/auth/oauth/google` → **302** vers `accounts.google.com` + cookies
  state/verifier posés. (Callback complet non e2e-testable sans Google — couvert par
  units + échange mocké.)

**Critères** :
1. `GET /auth/oauth/google` → 302 Google + cookies httpOnly state/verifier.
2. Callback state mismatch → `?error=oauth_expired` ; succès → cookie session posé +
   redirect front **sans token dans l'URL**.
3. `findOrCreateGoogleUser` : login/lien/création corrects.
4. App boote sans `GOOGLE_*` ; init OAuth → 503 propre.
5. Tous les tests verts ; aucune régression B1/B2/B3.

## Hors-périmètre

- Autres providers (GitHub…), import avatar Google en S3/R2, demo.
