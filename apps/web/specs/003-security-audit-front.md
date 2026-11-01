---
type: security-audit
---

# Audit de sécurité — frontend (ng-dashflow-app)

Déclenché le 2026-07-22, lecture seule. Complète `specs/001-intake-audit-repo.md` (F002/F003 déjà résolus,
non rejoués) et `specs/002-intake-audit-repo.md` (dimension 8 du même jour, non dupliquée). Backend
(`nest-dashflow-app`) hors scope — audité séparément.

## Constats

### 1. [Élevée] Fuite de données déchiffrées vers Sentry via les breadcrumbs console

**Fichiers** : `src/app/core/services/crypto/validate-decrypted.ts:6` + `src/main.ts:8-17`.

```ts
// validate-decrypted.ts:5-7
function reportInvalid(ctx: ValidateCtx, issues: readonly z.core.$ZodIssue[]): void {
  console.error(`[E2EE] ${ctx.entity} : ligne déchiffrée invalide, exclue.`, issues);
}
```

Garde-fou ajouté en remédiation de F002 (audit 001) — bonne intention, mais introduit un nouveau vecteur de
fuite. Zod v4 attache `input: unknown` (la valeur brute reçue) à chaque `$ZodIssue`
(`node_modules/.pnpm/zod@4.4.3/.../core/errors.d.ts:120`). `issues` peut donc contenir le champ déchiffré
fautif en clair (montant, note médicale...).

`@sentry/angular` v10 active par défaut `breadcrumbsIntegration({ console: true })`
(`@sentry/browser/build/.../integrations/breadcrumbs.js:9-16`), qui capture les arguments bruts de tout
`console.error` (`breadcrumb.data.arguments = handlerData.args`, ligne 112), sans troncature ni scrubbing.
`main.ts` ne configure ni `beforeBreadcrumb` ni `integrations: [breadcrumbsIntegration({ console: false })]`.

**Scénario d'exploitation** : une ligne déchiffrée qui échoue au schéma (bug de migration, corruption
partielle, désync de schéma après déploiement) déclenche `console.error(..., issues)` → breadcrumb stocké →
si une erreur est capturée par Sentry plus tard dans la session, les breadcrumbs (donc potentiellement le
champ déchiffré) partent vers `ingest.de.sentry.io`, un SaaS tiers. Casse directement la promesse E2EE sans
qu'un attaquant ait besoin d'accéder au backend.

**Recommandation** :

- Ne jamais passer `issues` brut à `console.error` : ne logger que `issues.map(i => ({ code: i.code, path: i.path }))`.
- `Sentry.init({ ..., integrations: [Sentry.breadcrumbsIntegration({ console: false })] })` ou `beforeBreadcrumb` qui rejette `category === 'console'`.

### 2. [Élevée] `initialBalance` transmis et stocké en clair côté serveur (incohérence E2EE)

**Fichier** : `src/app/features/budget/infra/http-bank-account.gateway.ts:12,15,21`

```ts
const CLEARTEXT_KEYS = ['id', 'userId', 'initialBalance', 'createdAt'] as const;
```

`initialBalance` est explicitement exclu du chiffrement. Le même problème technique (Postgres renvoie les
`numeric` en string) est correctement géré ailleurs en gardant le chiffrement : `envelope.balance`/`target`
(`http-envelope.gateway.ts:17-26`), `loan.amount`/`remaining` (`http-loan.gateway.ts:17-26`),
`transaction.amount` (`http-account-transaction.gateway.ts:23-26`) sont tous chiffrés, coercition `Number(...)`
faite après déchiffrement. Incohérence/régression locale à ce fichier, pas une limite technique réelle.

**Scénario d'exploitation** : un accès à la base de données du backend (compromission, dump de sauvegarde,
insider, réquisition légale) révèle le solde initial exact de chaque compte bancaire de chaque membre de la
famille, alors que l'app vend « aucun montant traité en clair côté serveur ». Combiné à `direction` (aussi en
clair sur les transactions), fuite ponctuelle réelle et évitable.

**Recommandation** : chiffrer `initialBalance` comme les autres montants, coercition `Number()` dans
`coerceBankAccount` après `decryptList`/`decryptOne` (symétrique à `coerceEnvelope`/`coerceLoan`).

### 3. [Moyenne] Clé maîtresse E2EE persistée en clair dans `sessionStorage`

**Fichier** : `src/app/core/services/crypto/crypto.store.ts:3, 152-155`

La clé AES-256 maîtresse est exportée en clair (base64) dans `sessionStorage` pour survivre à un refresh sans
redemander le mot de passe. Lisible par tout JS s'exécutant dans la page (XSS). Aucun vecteur XSS actif trouvé
dans ce repo (cf. faux positifs) → risque théorique aujourd'hui, mais point de compromission total si un XSS
apparaissait un jour : quiconque lit cette clé déchiffre l'intégralité des données budget + médicales.

**Recommandation** : compromis UX (persistance de session) contre surface d'attaque — décision à documenter
comme assumée. Alternative plus dure : IndexedDB avec clé `extractable: false` + re-dérivation au reload
(sacrifie l'UX actuelle, à trancher en équipe).

### 4. [Élevée] Aucun en-tête de sécurité HTTP (CSP, X-Frame-Options, etc.)

**Fichier** : `nginx.conf` (racine) + `src/index.html` (aucun repli meta).

Pas de `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`.

**Scénario d'exploitation** : absence de `frame-ancestors` → clickjacking possible sur login/unlock/suppression
de compte. Absence de CSP → pas de filet de rattrapage si un XSS apparaît (lien direct avec le constat 3 :
exfiltration de la clé maîtresse de session). Absence de `nosniff` → risque de MIME-sniffing.

**Recommandation** (bloc `nginx.conf`, `location /`) :

```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Content-Security-Policy "default-src 'self'; connect-src 'self' https://api-dashflow.nedellec-julien.fr https://*.ingest.de.sentry.io; img-src 'self' data:; style-src 'self' 'unsafe-inline'; base-uri 'self'; frame-ancestors 'none'" always;
```

(CSP à affiner/tester en staging — `'unsafe-inline'` sur `style-src` probablement nécessaire pour Angular/Tailwind.)

### 5. [Faible] Options `dataCollection` Sentry laissées aux valeurs par défaut (latent)

**Fichier** : `src/main.ts:11-15`

Config actuelle correcte (`sendDefaultPii: false`, `userInfo: false`, `httpBodies: []`), mais `cookies`,
`httpHeaders`, `queryParams`, `stackFrameVariables` non-couverts explicitement. Inerte aujourd'hui
(`httpClientIntegration()` non activée), mais dette de configuration silencieuse si activée un jour.

**Recommandation** : expliciter `cookies: false, httpHeaders: { request: false, response: false }, queryParams: false`.

### 6. [Faible] CVE js-yaml (modérée + haute) dans la chaîne de dépendances de production

`pnpm audit --prod` : `GHSA-h67p-54hq-rp68` (modérée, CVE-2026-53550) et `GHSA-52cp-r559-cp3m` (haute,
CVE-2026-59869), DoS algorithmique dans `js-yaml` via `@jsverse/transloco@8.3.0 > transloco-utils > cosmiconfig

> js-yaml@4.1.1`. Postérieures à l'audit 001 (2026-06-15 et 2026-07-20) — régression réelle depuis, pas un oubli.
> Exploitabilité faible : outillage CLI d'extraction i18n (dev/build), pas le runtime bundlé navigateur.

**Recommandation** : `pnpm.overrides` sur `js-yaml@^4.3.0` (ou attendre bump `@jsverse/transloco-utils`).

### 7. [Faible, informatif] CVE devDependencies (hors --prod)

~50 avis (hono, undici, tar, immutable, fast-uri, sigstore...) via `@angular/cli`/`@angular-eslint/builder` →
`@modelcontextprotocol/sdk` + `ajv`. Aucune bundlée en prod (esbuild ne tree-shake que le code applicatif
importé). Outillage build/dev local uniquement, à suivre via mises à jour `@angular/cli`.

## Faux positifs écartés

- **XSS templates** : 0 `innerHTML`/`bypassSecurityTrust*`/`DomSanitizer` dans tout `src/app`.
- **JWT/token localStorage** : n'existe pas. Auth = cookie httpOnly + CSRF double-submit en mémoire (`CsrfStore`, signal non persisté).
- **DSN Sentry hardcodé** (`environment.prod.ts:6`) : pas un secret, DSN front public par design (écriture seule).
- **Source maps prod** : builder `@angular/build:application`, défaut `sourceMap: false`, non surchargé.
- **`POSTGRES_PASSWORD: password` dans `git log -p`** : contenu tutoriel vendoré (`.claude/skills/docker/`), pas un secret réel.
- **Guard admin client** (`canMatch: [adminGuard]`) : correct en garde UX, autorisation réelle vérifiée serveur (hors scope).
- **Mode démo** : reset via endpoint dédié, pas de bypass d'auth réutilisable côté client.
- **Casts `as T` couche crypto** : déjà tranché faux positif par l'audit 001 (F002), garde runtime désormais en place.

## Synthèse

Hygiène de sécurité globalement solide (pas de JWT en localStorage, pas de XSS trouvé, PBKDF2 600k itérations +
AES-GCM + wrapping de clé bien conçu, aucune CVE exploitable en prod). Top risque : la combinaison des
constats 1 et 2, deux fuites concrètes et non-théoriques de données que l'app promet de ne jamais exposer en
clair — l'une vers Sentry (SaaS tiers), l'autre vers le backend lui-même (`initialBalance`). Les deux sont des
régressions ciblées, faciles à corriger, à traiter avant le durcissement des en-têtes HTTP (constat 4).
