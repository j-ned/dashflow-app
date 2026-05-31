# Phase B0 — Fondation NestJS

**Date :** 2026-05-31
**Repo :** `nest-dashflow-app` (futur backend, scaffold NestJS 11)
**Statut :** approuvé, prêt pour plan d'implémentation

## Contexte

Phase B = migration du backend DashFlow de **Hono** (embarqué dans le repo Angular
`dash-flow/backend`) vers **NestJS** (repo dédié `nest-dashflow-app`), puis retrait
du backend du repo Angular.

**Stratégie de migration : big-bang en fin de parcours.** On construit tout le
backend NestJS étape par étape sur un port distinct, testé contre la DB locale
partagée (Podman, cf. spec phase A), pendant que Hono reste live et intouché. Le
front Angular ne bascule qu'à la toute dernière étape (B-final), en une fois, avec
le passage aux cookies httpOnly. Puis Hono est supprimé du repo Angular. Aucun
double contrat à maintenir.

**Découpage de la phase B :**

| Étape | Contenu |
|---|---|
| **B0 (ce spec)** | Fondation : structure, module Drizzle, config/env, pipe Zod, filtres, health, Vitest, CLAUDE.md backend-focused |
| B1 | Auth core : register/verify/resend/login/me/password/reset (+recovery) · JWT cookie httpOnly · argon2 · emails |
| B2 | TOTP 2FA |
| B3 | Chiffrement E2EE (wire-compatible avec le client Angular existant) |
| B4 | OAuth Google (arctic + PKCE) |
| B5+ | Modules data (envelopes, loans, patients…) |
| B-final | Bascule front (cookies/withCredentials) + décommission Hono |

B0 ne contient **aucune logique métier** : c'est le socle technique et les
conventions sur lesquels reposent B1+.

## Décisions de cadrage

- **Tests** : **Vitest** (aligné sur la convention du CLAUDE.md et le front Angular),
  décrochage de Jest du scaffold.
- **CLAUDE.md** : réécriture **backend-focused**, présentée pour validation avant
  écriture (exception assumée à la règle « patch atomique », car refonte demandée).
- **Baseline du schéma** : port verbatim du `schema.ts` Hono (réorganisé par
  domaine), **aucune migration jouée** sur la DB partagée en B0.
- **Repo standalone** : arborescence `src/...` (on abandonne le `apps/api/...` du
  CLAUDE.md actuel, qui supposait un monorepo).

## Arborescence cible

```
src/
├── main.ts                 # bootstrap : helmet, CORS+credentials, cookie-parser, prefix /api, pipe+filtre globaux, shutdown hooks
├── app.module.ts           # racine : Config, Drizzle, Health
├── config/
│   ├── env.schema.ts        # schéma Zod des variables d'env + type Env = z.infer<...>
│   └── config.module.ts     # @nestjs/config isGlobal + validate(env) au boot
├── db/
│   ├── schema/
│   │   ├── auth.ts          # users, verification_codes
│   │   ├── finance.ts       # bank_accounts, envelopes, envelope_transactions, loans, loan_transactions, recurring_entries, salary_archives
│   │   ├── medical.ts       # patients, practitioners, appointments, prescriptions, medications
│   │   ├── shared.ts        # documents, shared_access
│   │   └── index.ts         # barrel (réexport pour le client drizzle)
│   ├── drizzle.module.ts    # @Global, fournit le token DRIZZLE
│   └── drizzle.constants.ts # export const DRIZZLE = injection token
├── common/
│   ├── pipes/zod-validation.pipe.ts
│   └── filters/http-exception.filter.ts
└── health/
    ├── health.module.ts
    ├── health.controller.ts # GET /api/health + ping DB
    └── health.controller.spec.ts
drizzle.config.ts
vitest.config.ts
```

Conventions : un concept par fichier ; `*.module.ts` / `*.controller.ts` /
`*.service.ts` / `*.repository.ts` par feature (à partir de B1) ; Drizzle dans
`db/` ; transverses dans `common/`.

## Couche données Drizzle

- `DrizzleModule` `@Global` fournit le token `DRIZZLE` = `drizzle(postgres(DATABASE_URL))`
  (driver **postgres-js**, identique à Hono). Injecté via `@Inject(DRIZZLE)` dans
  les repositories (B1+). Connexion fermée proprement (`onModuleDestroy` →
  `sql.end()` + `app.enableShutdownHooks()`).
- **Gotcha** : dans tout `sql\`…${date}…\`` brut, toujours `date.toISOString()`
  (sinon crash bind postgres-js).
- **Baseline (approche retenue : port verbatim)** : le `schema.ts` Hono est reporté
  à l'identique, réorganisé par domaine. Comme ce schéma a créé la DB, le match est
  garanti. `drizzle-kit` est configuré (generate/studio) mais `migrate` n'est **pas**
  lancé en B0. Quand les migrations reprendront (vers le cutover), le repo NestJS
  utilisera sa **propre table de migrations** (`migrations.table` dédié) pour ne pas
  corrompre le journal `drizzle.__drizzle_migrations` de Hono.
- **Vérif d'intégrité B0** : script comparant tables/colonnes attendues du schéma
  porté vs la DB locale (introspection légère) + `GET /api/health` qui ping la DB.

## Config / validation / erreurs

- **Config** : `@nestjs/config` `isGlobal`, fonction `validate` parsant `process.env`
  via `env.schema.ts` (Zod) au boot → refus de démarrer si variable
  requise manquante/invalide. Parité avec Hono : `DATABASE_URL` requis, `JWT_SECRET`
  ≥32 chars (préparé pour B1), `CORS_ORIGIN`, `PORT`, etc. Type `Env = z.infer<...>`.
- **`ZodValidationPipe`** (hand-rolled, ~15 lignes) : pattern **officiel** de la doc
  NestJS (chapitre Pipes). Zéro dépendance hors `zod`. Erreur → 400, premier message
  Zod, format cohérent.
- **`HttpExceptionFilter`** global : normalise toute erreur en
  `{ statusCode, error, message, path, timestamp }`. Les services suivront le Result
  pattern (B1+), traduit en HTTP au bord.

## Bootstrap (`main.ts`)

- **`helmet`** : remplace les en-têtes de sécurité custom de Hono (X-Frame-Options,
  nosniff, HSTS prod, Referrer-Policy…). Recommandation officielle NestJS.
- **CORS** : `origin` depuis config (`CORS_ORIGIN`), **`credentials: true`**
  (indispensable cookies httpOnly B1).
- **`cookie-parser`** : posé dès la fondation (socle auth cookie B1).
- **`app.setGlobalPrefix('api')`** : parité avec le montage `/api` de Hono → proxy
  Angular et chemins inchangés au cutover.
- **`ZodValidationPipe`** + **`HttpExceptionFilter`** en global.
- **`app.enableShutdownHooks()`** : fermeture propre de postgres-js.
- **Port** : depuis config. En dev pendant la cohabitation big-bang, NestJS sur
  **3001** (Hono occupe 3000). Le cutover remettra le port voulu.

## Setup Vitest

- Retrait config `jest` du `package.json` + déps Jest (jest, ts-jest, @types/jest).
- Ajout `vitest`, `unplugin-swc`, `@swc/core` (transforme décorateurs/metadata Nest,
  nécessaire à la DI dans les tests). `@nestjs/testing` conservé (compatible Vitest).
- `vitest.config.ts` : plugin swc, `globals: true`, `environment: node`,
  `include: ['src/**/*.spec.ts']`, support e2e (`test/**/*.e2e-spec.ts`).
- Scripts : `test`, `test:watch`, `test:cov`, `test:e2e`.
- Spec de fumée : `health.controller.spec.ts` (TDD) prouve Vitest+swc+DI.

## Réécriture CLAUDE.md (backend-focused)

Version centrée backend, **présentée pour validation avant écriture**.

**Conservé** (transverse) : Méthodologie/Rigueur/Ton, structure des réponses,
Conventions code (anglais, Conventional Commits, TS strict, Result pattern, suffixes
domain), Clean Architecture EAK adaptée backend, Workflow Claude, Auto-révision du
CLAUDE.md, Sources officielles, Commandes.

**Retiré** (purement Angular) : composants/inputs/outputs/model(), afterRender, Host,
Templates, NgOptimizedImage, @defer, Zoneless, Reactive Forms, Routing Angular,
Signals/RxJS, CSS/Tailwind.

**Développé selon la doc officielle (avec liens)** :
- NestJS : module/controller/service/repository, DI & providers, `@Global`, pipes
  (ZodValidationPipe officiel), exception filters, guards/interceptors, lifecycle
  hooks, config validée.
- Drizzle : schéma typé + `$inferSelect/$inferInsert`, repository pattern, relations,
  migrations drizzle-kit, gotcha date postgres-js.
- Zod aux frontières : 1 schéma par DTO, `z.infer`, sortie via DTO de réponse (jamais
  l'entité Drizzle).
- Auth cookies httpOnly : section dédiée préparée pour B1 (cookie httpOnly/Secure/
  SameSite, CSRF, argon2).
- Vitest backend : `Test.createTestingModule`, mocks de providers, intégration DB de
  test, swc.

## Critères de succès

1. `pnpm start:dev` démarre NestJS sur `:3001` sans erreur ; env validé au boot
   (échec propre si variable manquante).
2. `GET /api/health` → `200` avec ping DB OK.
3. Schéma Drizzle porté = DB locale (vérif d'intégrité verte).
4. `pnpm test` (Vitest+swc) passe, dont la spec de fumée `health`.
5. `ZodValidationPipe` + `HttpExceptionFilter` + helmet + CORS(credentials) +
   cookie-parser actifs.
6. `CLAUDE.md` backend-focused validé et en place.
7. Aucune migration jouée sur la DB partagée ; journal Hono intact.

## Hors-périmètre (étapes suivantes)

- Logique métier d'auth (register/login/cookies/TOTP/E2EE) → B1+.
- OAuth, emails, S3/R2 → étapes dédiées.
- Modules data (envelopes, loans, patients…) → B5+.
- Bascule front + décommission Hono → B-final.
