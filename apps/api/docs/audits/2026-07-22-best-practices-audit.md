# Audit qualité de code / dette technique — nest-dashflow-app

Déclenché le 2026-07-22, lecture seule.

## Vue d'ensemble

Backend NestJS bien structuré par feature, discipline TypeScript remarquable (zéro `any`, zéro cast suspect,
zéro `@ts-ignore` dans `src/`), filtre d'exception global cohérent, pattern Result appliqué systématiquement
dans `auth`. La dette se concentre sur trois axes : (1) une couche DTO de sortie quasi inexistante hors du
module `auth` (les entités Drizzle sont sérialisées telles quelles), (2) une couverture de tests très
inégale — les modules financiers les plus critiques (`envelopes`, `loans`) n'ont aucun test malgré une
logique de calcul de solde non triviale, (3) des tests d'intégration existants (dont un test anti-régression
exactement sur l'incident déjà vécu "migration cassée = 502") jamais branchés en CI.

## Constats priorisés

### Élevée

1. **Aucun DTO de réponse hors `auth` — l'entité Drizzle est exposée telle quelle.**
   `src/common/crud/owned-crud.controller.ts:42-69` et tous les services `extends OwnedCrudService` (15
   services : `envelopes.service.ts`, `loans.service.ts`, `bank-accounts.service.ts`...) retournent
   directement les lignes `.select()`/`.returning()` au client JSON. Seul `src/auth/auth.response.ts`
   (`toPublicUser`/`toKeyMaterial`) applique la convention déclarée. Conséquence : le schéma DB devient de
   facto le contrat d'API — un `ALTER TABLE` change la réponse HTTP sans révision explicite.
   *Recommandation* : mapper léger par module, en commençant par les modules financiers.

2. **Deux mécanismes de validation d'entrée coexistent, aucun ne correspond à la convention déclarée.**
   `auth.controller.ts` utilise `@Body(new ZodValidationPipe(schema))`, mais 0 occurrence de
   `ZodValidationPipe` dans `src/modules/`. Les 18 autres modules utilisent un helper manuel `parseBody`
   (`src/common/parse-body.ts`) appelé à la main. `OwnedCrudController.create`/`update`
   (`owned-crud.controller.ts:56,66`) prennent un `@Body() body: Record<string, unknown>` non validé par
   pipe — rien ne l'impose au niveau du contrat.
   *Recommandation* : unifier sur un seul mécanisme, ou documenter `parseBody` comme convention réelle.

3. **`envelopes`/`loans` : zéro test malgré une logique de calcul non triviale.**
   `loans.service.ts` (`recordPayment`, l.51-77) et `envelopes.service.ts` (`credit`, l.64-107) contiennent
   des transactions DB + arithmétique monétaire sans `.spec.ts`. 7/19 modules sans aucun test :
   `appointments`, `bank-accounts`, `consumables`, `demo`, `envelopes`, `loans`, `practitioners` — mais
   `bank-accounts`/`consumables` sont du CRUD pur (risque faible), `envelopes`/`loans`/`demo` portent une
   vraie logique métier non couverte.
   *Recommandation* : prioriser `envelopes.service.ts` et `loans.service.ts`.

4. **Tests d'intégration existants jamais exécutés en CI.**
   `.github/workflows/ci.yml` ne lance que lint/build/test unitaire + un job e2e séparé. Le script
   `test:integration` (`vitest.integration.config.ts`) n'apparaît nulle part dans le workflow. Or
   `test/schema-integrity.integration-spec.ts` est exactement le filet de sécurité qui aurait détecté
   l'incident déjà documenté ("Drizzle migrate crash au boot = 502"). Même angle mort que sur le projet ERP
   (`api:test-integration` hors CI) — pas un accident isolé.
   *Recommandation* : ajouter une étape CI pour `pnpm test:integration` (le job e2e a déjà Postgres + migration).

### Moyenne

5. **`no-explicit-any` désactivé** (`eslint.config.mjs:29`), en contradiction avec la convention déclarée. Code
   actuellement propre (0 `any` vérifié) mais rien n'empêche une régression silencieuse, la CI ne bloquerait
   pas. `no-floating-promises`/`no-unsafe-argument` en `warn`, pas `error`.
   *Recommandation* : repasser `no-explicit-any` en `error` (coût nul aujourd'hui).

6. **Duplication du type énuméré entre schéma Drizzle et DTO Zod, sans dérivation automatique.**
   `src/db/schema/finance.ts:16-19` (`envelopeTypeEnum`) vs `src/modules/envelopes/dto/envelope.dto.ts:14`
   (`ENVELOPE_TYPES`) — deux listes indépendantes, synchronisées aujourd'hui mais rien ne les lie. Probable
   sur d'autres enums (confirmé par knip signalant ces enums Drizzle comme "exports inutilisés" ailleurs).
   *Recommandation* : dériver le schema Zod depuis l'array source unique.

7. **`.env.example` documente encore intégralement Stripe** (section entière, 4 variables) alors que la
   monétisation a été retirée début juillet. Retrait propre côté code exécutable (aucune variable Stripe dans
   `env.schema.ts`, aucun module `billing`/`stripe`, migration `0006_drop_monetisation.sql` cohérente) — seul
   `.env.example` traîne comme résidu.
   *Recommandation* : supprimer la section Stripe.

8. **`test/jest-e2e.json` : configuration Jest morte**, résidu du scaffold NestJS jamais nettoyé après
   migration vers Vitest. Aucune dépendance `jest`/`ts-jest`, aucun script ne le référence.
   *Recommandation* : suppression simple.

### Faible

9. **`ConsoleMailer` log deux fois la même information** (`src/mail/console.mailer.ts`) — `this.logger.log`
   puis `console.log` juste en dessous, sur les 4 méthodes. Seuls `console.log` du repo, vestige de debug.
   *Recommandation* : garder uniquement `this.logger.log`.

## Bonnes pratiques notables

- Discipline TypeScript exemplaire : 0 `any`, 0 cast `as any`, 0 `@ts-ignore`/`@ts-expect-error` dans tout `src/`.
- Filtre d'exception global cohérent (`src/common/filters/http-exception.filter.ts`) : format JSON uniforme,
  capture Sentry limitée aux 5xx.
- `OwnedCrudController`/`OwnedCrudService` (`src/common/crud/`) : bonne factorisation anti-duplication du
  CRUD scoped-par-utilisateur.
- Migrations Drizzle propres : nommage généré, aucune édition manuelle suspecte.
- Retrait de la monétisation réellement complet côté code (migration idempotente, pas de module résiduel).
- `salary-archives.controller.spec.ts` documente en commentaire l'incident réel qu'il prévient (bug multipart
  déjà vécu et corrigé) — bonne pratique de test-comme-documentation.

## Faux positifs écartés

- `grep stripe` dans `account-transactions.service.ts` : commentaire sans rapport avec Stripe.
- `knip` "reflect-metadata"/"rxjs" inutilisés + 8 devDependencies : environnement `npx knip` isolé ne résout
  pas l'arborescence pnpm correctement (échec `unplugin-swc`/`dotenv/config`). `rxjs` confirmé réellement
  candidat au nettoyage (transitif `@nestjs/core`), les devDeps flaggées sont des faux positifs évidents.
- "38 fichiers inutilisés" knip : 100% des `.spec.ts`, faux positifs mécaniques (knip ne connaît pas Vitest
  sans config dédiée).
- `medical-calendar.controller.ts` sans `parseBody` : endpoint GET pur sans body.
- Mémoire utilisateur "Sentry back non commité" : obsolète — `git status` propre, commit `001cf6e` déjà sur
  `master` et poussé.

## 3 priorités concrètes

1. Brancher `pnpm test:integration` dans `.github/workflows/ci.yml` — le filet de sécurité anti-régression
   migration existe déjà, coûte une étape CI, couvre un incident déjà vécu sur ce projet.
2. Écrire les tests manquants sur `envelopes.service.ts` et `loans.service.ts` avant tout refactor futur —
   vrai risque financier du repo aujourd'hui.
3. Introduire un DTO de sortie explicite au moins sur les modules financiers, en étendant le pattern
   `auth.response.ts` à `envelopes`/`bank-accounts`/`loans`.
