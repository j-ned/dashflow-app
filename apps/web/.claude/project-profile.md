# Profil-projet AAK — dash-flow

> Généré par `/aak-init-profile`. Adapté à la main si besoin.
> Les 4 agents AAK lisent ce fichier à chaque invocation.

## Projet & langue

- **Nom du projet** : `dash-flow`.
- **Langue des livrables** (specs, ADRs, rapports) : **français**. Identifiants de
  code et noms de patterns établis restent en VO.

## Gestionnaire de paquets & commandes canoniques (gates)

- **Gestionnaire** : `pnpm`, version `≥ 9.15.4`. Binaire installé :
  `pnpm exec <cmd>` ; ad-hoc : `pnpm dlx <pkg>`. **Aucune** autre commande
  ne franchit les gates.
- **test** (source de vérité du typecheck) : `pnpm test` (= `ng test`, builder
  `@angular/build:unit-test` → Vitest + jsdom). Type-checke **les `*.spec.ts`
  incluses** : `tsconfig.spec.json` inclut `src/**/*.spec.ts` (vérifié).
- **lint** : `pnpm lint` (= `ng lint`, ESLint 10 flat config + typescript-eslint +
  angular-eslint v21). Zéro warning, zéro erreur. Encode les conventions maison :
  `type` (pas `interface`), `T[]`, OnPush obligatoire, `inject()`, signals appelés,
  control flow, NgOptimizedImage. `any` interdit **partout, specs incluses** (accès
  white-box typé via cast d'internals, mocks via `vi.fn()`).
- **format** : `pnpm format:check` (Prettier — gate de mise en forme **séparé** du
  lint via `eslint-config-prettier`, reco officielle Prettier). `pnpm format` pour
  corriger. Codebase 100% prettier-clean, gate en CI.
- **build** : `pnpm build` (= `ng build`, configuration `production`). N'est
  **pas** la source de vérité des types (le typecheck des specs passe par `test`).
- **invalidation cache** : `aucun` — pas de système de cache de build orchestré
  (pas de Nx). **Systèmes concernés** : cache Vite/Vitest (`node_modules/.vite`),
  build incrémental tsc (`out-tsc/`). Absent ⇒ `qa`, `code-reviewer` et
  `intake-auditor` tracent « invalidation cache non vérifiée ».

## Stack & bibliothèques (choix structurants)

- **Version Angular & détection par défaut** : **Angular 21** (`@angular/core ^21.2.0`).
  `changeDetection: ChangeDetectionStrategy.OnPush` doit être écrit **explicitement**
  (OnPush n'est le défaut framework qu'à partir de v22). Mettre à jour ce champ lors
  d'une migration v22 (où OnPush devient implicite sur projet neuf, mais reste
  `Eager` sur projet migré via `ng update`).

- **État partagé** : stores signals maison (`*.store.ts`, p. ex. `auth.store`,
  `crypto.store`, `csrf-store`). Pas de NgRx. **Seuil de promotion en store** :
  partagé entre **2+ composants non liés**. Sous le seuil : signals locaux.
- **Coordinateur de feature (facade)** : `aucun` pour l'instant — les composants
  smart injectent directement gateways / use-cases. Naming/portée à définir si
  un coordinateur apparaît (critères store vs facade = discipline universelle).
- **Validation aux frontières** : `aucune` lib (pas de Zod/Yup/Valibot).
  L'adaptation DTO API → modèle domaine passe par des **fonctions pures**
  (`infra/*.adapter.ts`). Absence de validation runtime aux frontières ⇒ tracée
  en finding par `code-reviewer`.
- **Persistance** : backend **REST** (`@core/services/api/ApiClient`), avec CSRF
  (`csrf-store`) et chiffrement **E2E** (`crypto.store`, WebCrypto). Backend/auth :
  **oui** (feature `auth`, comptes démo inclus).
- **Async / réactivité** : gateways exposent des `Observable` RxJS ; les stores
  consomment via `firstValueFrom`. `httpResource()`/`rxResource()` privilégiés
  pour les nouveaux GET ; RxJS réservé aux vrais flux.
- **Cross-platform** : `aucun` (PWA mobile-first, pas de Capacitor/Electron).
  Aucune abstraction native requise.
- **Forme des modèles** : `type` (jamais `interface`). Pas de dérivation depuis
  un schéma de validation (aucune lib) — les `type` sont écrits à la main dans
  `domain/models/`.

## Naming & arborescence

- **Nommage des fichiers** : kebab-case **sans suffixe** (`.component.` interdit,
  vérifié : 0 fichier `*.component.ts`). Templates inline (SFC). Stores `*.store.ts`,
  gateways `*.gateway.ts`, adapters `*.adapter.ts`.
- **Préfixe sélecteur** : `app` (cf. `angular.json`).
- **Pages de feature** : `src/app/features/<x>/pages/**`.
- **DS / primitives partagées** : `src/app/shared/components/**` (+ `shared/validators/**`).
- **Domaine pur** (logique testable hors UI) : `src/app/features/<x>/domain/**`
  (TS pur, specs colocalisés ; gateways abstraits dans `domain/gateways/`).
- **Path alias** : `@env/*`, `@core/*`, `@features/*`, `@shared/*`.
- **Seuils d'altitude composant** (gate advisory `code-reviewer`, non bloquant) :
  LOC **200**, collaborateurs injectés **5**. Au-delà, un composant touché par
  une PR est signalé « candidat découpe ».

## Styling & design system

- **Règle styling** : TailwindCSS **v4 CSS-first**, tout en utility classes
  (templates + `host: { class }`). Tokens sémantiques via `@theme` dans
  `styles.css`. Pas de couleur/espacement en dur. Réutilisation = composant
  Angular, pas `@apply`.
- **Localisation des styles** : **pas de fichier `.css`/`.scss` par composant**.
  `shared/components/**` et `features/**/pages` → utility classes inline.
  `styles: ` inline réservé aux exceptions (keyframes, pseudo-éléments complexes,
  `background-clip: text`, `::autofill`/`::selection`/`::placeholder`).
- **Nom du DS / palette** : **IBKR-inspired dark palette** (préfixe tokens `ib-`).
- **Tokens-clés** : `--color-canvas`, `--color-surface`, `--color-raised`,
  `--color-border`, `--color-text-primary`, accents `--color-ib-{blue,cyan,green,
  orange,red,purple,yellow,pink}` (+ variantes opacité `-5`…`-50`), `--font-sans`
  (Inter Variable), `--font-mono` (JetBrains Mono Variable), `--radius-{sm,md,lg}`.
  Contrastes accents annotés ≥ 4.7:1 sur `--color-canvas`.
- **Cible & viewport de référence** : **PWA mobile-first** (≈ 375×667), montant
  vers desktop.
- **Tokens cross-platform** (safe-area, gestes) : `aucun`.

## Tests

- **Régime zone** : **zoneless** (aucune dépendance `zone.js` dans `package.json`).
  ⇒ **jamais** `fakeAsync`/`tick`/`flush`/`waitForAsync` (helpers `zone-testing`,
  plantent au runtime). Async/timers : fake timers du runner (`vi.useFakeTimers`)
  + `await fixture.whenStable()`. Cf. skill `angular-async-testing`.
- **Statut des adapters in-memory / fakes de persistance** : **aucun** (aucun
  `*in-memory*` détecté dans `src/`). Si un fake de persistance apparaît, statuer
  `fake test-only` (doublure, non testée directement) ou `implémentation runtime`
  (code livrable, testable) selon qu'un backend est branché ou non.
- **Framework** : **Vitest 4** + jsdom (builder `@angular/build:unit-test`).
- **Frontières d'I/O** (seuls fakes légitimes — liste **fermée**) : requêtes
  **réseau (HTTP)** (`provideHttpClientTesting` + `HttpTestingController` + `verify()`),
  **horloge / timers**, **crypto / source d'aléa** (WebCrypto, sel/IV/clés
  déterministes en test), **localStorage / stockage navigateur**.
- **Carve-out unitaire direct** (sacré, ne pas collapser dans une page) :
  **domaine pur** (`features/<x>/domain/**`), **validators partagés**
  (`shared/validators/**`), **adapters infra** (`*.adapter.ts`), **primitives UI
  shared** (`shared/components/**`).
- **Projet de test visuel** (DOM réel, navigateur) : `aucun`.
- **Glossaire domaine / builders** : builders observés `makeUser`, `buildGroup`,
  `makeComponent`. Agrégats domaine candidats à un builder (construits >1× dans
  les tests) : `Envelope`, `BankAccount`, `RecurringEntry`, `Loan`,
  `AccountTransaction`, `Member`.
- **Exemple Router-en-test stable** : `aucun` (pas de spec router, pas de guard à
  ce jour). Spec de référence HTTP stable :
  `src/app/features/budget/infra/http-envelope.gateway.spec.ts`.

## Revue UI/design (optionnelle)

- **Outil de scoring visuel** : `aucun` ⇒ régime de validation manuelle/structurelle
  (DOM, a11y AXE, WCAG AA).
- **Chemin du bundle compilé** (grep des règles `[_nghost-…]`) : `dist/dash-flow/`.
- **Composants à forte interaction tactile** (validation interactive séparée) :
  `app-command-palette`, `app-modal-dialog`, `app-confirm-dialog`, `app-toast`.

## Politique commentaires (archéologie interdite)

- **Pattern grep d'archéologie** (mécanique, sans jugement) :
  `ADR-[0-9]|spec [0-9]{3}|§ ?[A-Z]|ajouté pour|/\*\*`.
- **Règle** (rappel — universelle) : par défaut **aucun** commentaire ; seul
  légitime = **une ligne** de WHY intemporel non-évident. Interdits : numéro de
  spec/ticket, réf ADR/§, récit de diagnostic/rétro, « ajouté pour X », le QUOI,
  le bloc narratif.
- **Garde-fou `pre-commit`** : `aucun` (pas de husky/lint-staged détecté).

## Patterns projet (respectés ; signalés en finding si violés)

- Clean Architecture EAK 3 couches par feature : `domain/` (TS pur, zéro import
  Angular) → `infra/` (services HTTP, adapters) ; `application` ne dépend jamais
  directement d'`infra` (câblage dans les providers / `app.config.ts`).
- Gateway = `abstract class` dans `domain/gateways/`, implémentation
  `infra/http-*.gateway.ts` câblée via `{ provide: XGateway, useClass: HttpXGateway }`.
- Adapter = **fonction pure** (`toAppointment(raw)`), types API isolés dans `infra/`.
- Stores signals maison encapsulés (`private _x = signal()` + `asReadonly()`),
  `*.store.ts`, jamais `mutate`, toujours nouvelles références.
- Modèles en `union types` discriminés pour les polymorphes
  (`type RecurringEntryType = 'income' | 'expense' | …`), jamais d'`enum`.
- i18n **Transloco** : clés i18n + params passés au Toaster, jamais une string
  déjà traduite.

## Outillage intake (`intake-auditor`, dimensions 1/5/10)

- `pnpm dlx madge --circular --extensions ts` (cycles) ;
  `pnpm dlx knip` (dead code) ;
  `pnpm dlx depcheck` (deps inutilisées) ;
  `pnpm audit --prod` (CVEs). Dégradation propre si un outil échoue.
- **CI/CD** (dimension 10, **GitHub Actions uniquement**) : workflow
  `.github/workflows/ci.yml` (push/PR sur `master`) : `pnpm lint` + `pnpm format:check`
  + `pnpm test`, puis Docker build. Le `build` Angular de prod (`pnpm build`) n'est
  pas un step dédié (le Docker build couvre la compilation).
