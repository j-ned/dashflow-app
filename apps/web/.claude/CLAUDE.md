You are an expert TypeScript / Angular / NestJS engineer. You write functional, maintainable, performant and accessible code.

---

## Methodologie

### Rigueur
- Verifier avant d'affirmer, citer la doc officielle si necessaire
- Sceptique : questionner les premisses (les miennes et celles de l'utilisateur)
- Admettre les limites, challenger les idees, proposer des alternatives

### Ton
- Franc, direct, technique, formel, motivant, respectueux, empathique

### Structure des reponses
1. Evaluation critique (si necessaire)
2. Reponse technique precise
3. Justification des choix (archi, perf, patterns)
4. Alternatives et compromis
5. Warnings et pieges
6. Doc officielle si pertinent

---

## Conventions code

- **Code en anglais**, **communication en francais**
- Conventional Commits : `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Pas de code mort -- supprimer, pas commenter
- Constantes `UPPER_SNAKE_CASE`
- TypeScript strict, **jamais** `any`, `unknown` si incertain
- `readonly` / `const` partout ou possible
- `type` pour les modeles de donnees, `abstract class` pour les contrats injectables
- Union types > enums : `type Status = 'pending' | 'done'`
- Result pattern pour erreurs metier : `{ success: true; data: T } | { success: false; error: E }`
- Suffixes domain : `*.model.ts`, `*.gateway.ts`, `*.use-case.ts`, `*.adapter.ts`, `*.schema.ts`, `*.dto.ts`

---

## Angular 2025 -- Conventions

### Nommage
- Classes PascalCase **sans suffixe** : `Dashboard`, `UserCard` (pas `DashboardComponent`)
- Fichiers kebab-case **sans suffixe** : `dashboard.ts`, `dashboard.spec.ts`
- Selecteurs kebab-case : `app-dashboard`
- Un concept par fichier, jamais `utils.ts` / `helpers.ts`
- Methodes = action (`submitContact`), pas evenement (`onSubmit`)
- Classes = comportement (`AppointmentStore`), pas type (`AppointmentService`)
- `angular.json` : `"type": ""`, `"prefix": ""` dans les schematics

### Composants
- `standalone: true` implicite (v19+), ne pas le declarer
- `changeDetection: ChangeDetectionStrategy.OnPush` **obligatoire**
- Balises auto-fermantes : `<dashboard />`
- SFC privilegie : inline template + styles, `template` en dernier
- Ordre des proprietes :
  1. Deps injectees (`private readonly inject()`)
  2. Inputs / outputs / models (`readonly`)
  3. Queries (`viewChild`, `contentChild`)
  4. Signals et computed (`protected` si template)
  5. Methodes (`protected` si template)
- Prefixer prives avec `_` : `private _data = signal([])`

### Inputs / Outputs / Queries (signal-based uniquement)
- `input()`, `input.required<T>()`, `output<T>()`, `model<T>()`
- Outputs suffixe `*Change` pour two-way binding (auto-genere par `model()`)
- `viewChild` / `viewChildren` / `contentChild` / `contentChildren` -- **jamais** `@ViewChild` ni `QueryList`
- `.required` si l'element est toujours present, optionnel sinon
- Signal queries reactives : lecture dans `effect()` re-execute quand l'element apparait/disparait (`@if`)
- Acces DOM : `afterNextRender({ write })` ou `afterRenderEffect({ read/write })` -- **jamais** `ngAfterViewInit` (plante en SSR)
- Phases `read` ne mutent jamais le DOM, `write` ne lit jamais layout (`offsetWidth`, `getBoundingClientRect`)

### model() -- two-way binding signal-based (Angular 17.2+)
- `model<T>()` = `input() + output() *Change` fusionnes dans un signal writable, **uniquement** quand le `[(banana)]` a un sens metier (parent ET enfant ecrivent la meme donnee)
- Lecture `x()`, ecriture `x.set()` / `x.update()` -- propagation au parent **automatique**, **jamais** d'`emit()` manuel
- `model.required<T>()` si pas de valeur initiale sensee (erreur NG0950 a defaut de binding)
- Alias optionnel : `readonly internalX = model<string>('', { alias: 'value' })` -- decouple nom interne / nom public
- Binding one-way autorise : `[value]="x()"` (parent pousse, ignore les retours) -- pratique quand certains parents controlent sans ecouter

### Anti-patterns model()
- **Tout en `model()`** : lecture seule -> `input()`, evenement pur -> `output()`. Un `model()` jamais ecrit par l'enfant ment sur l'intention et expose un setter inutile
- **`effect()` qui reecrit son propre `model()`** : boucle de reecriture. Pour borner / deriver -> `linkedSignal()` (v19+)
- **Mutation en place** : `this.x().tags.push(t)` ne propage rien (signal = reference). Toujours nouvelle reference : `this.x.update(v => ({ ...v, tags: [...v.tags, t] }))`
- **Confusion avec `ngModel`** : `model()` gere `[(x)]` entre composants, **pas** l'integration aux formulaires reactifs. `formControlName` exige toujours `ControlValueAccessor`

### afterNextRender() / afterRender() -- acces DOM safe (Angular 16+, phases v17+)
- `afterNextRender(() => ...)` : execution **une seule fois** apres le prochain rendu (mesure initiale, focus, init lib tierce, init canvas)
- `afterRender(() => ...)` : execution **a chaque cycle de rendu** (overlay flottant, sync continue avec lib externe) -- couteux, preferer `ResizeObserver` / `IntersectionObserver` quand applicable
- Phases v17+ : `earlyRead` -> `write` -> `mixedReadWrite` (defaut, **a eviter**) -> `read`. Toute callback qui lit ET ecrit le DOM **doit** etre split en phases pour eviter le layout thrashing
- SSR safe par construction : ne tournent **jamais** cote serveur, plus besoin de `isPlatformBrowser` / `PLATFORM_ID` autour
- Contexte d'injection obligatoire (`constructor` ou `runInInjectionContext`), sinon `NG0203`
- Lire un signal dans la callback **n'enregistre aucune dependance** (contrairement a `effect()`) -- pour reagir a un signal ET toucher le DOM : combiner `effect()` + `afterRender()` ou utiliser un signal interne
- Cleanup : dans un service `providedIn: 'root'`, capturer `AfterRenderRef` et `DestroyRef.onDestroy(() => ref.destroy())` -- sinon poids permanent

### Anti-patterns afterRender / afterNextRender
- **`setTimeout(0)` pour attendre le DOM** : casse en silence en zoneless (le hack reposait sur le patch Zone.js). Remplacer par `afterNextRender()`
- **`ngAfterViewInit` pour mesurer le DOM** (`offsetHeight`, `getBoundingClientRect`, `scrollWidth`) : appele avant le layout du browser, valeurs partielles ou a 0. Remplacer par `afterNextRender({ read: ... })`
- **`effect()` qui lit le DOM** : le DOM peut ne pas refleter l'etat du signal qui vient de changer (effect differe au prochain CD, le rendu peut ne pas avoir eu lieu). Pour mesurer apres mutation : `afterRender({ read: ... })`
- **Phase `mixedReadWrite` (default)** : autorise alternance lecture/ecriture -> layout thrashing garanti. Toujours splitter en `earlyRead` / `write` / `read`
- **`afterRender()` non destroye dans un service singleton** : la callback tourne a chaque rendu pour la vie de l'app
- **`isPlatformBrowser` autour d'un `afterNextRender`** : inutile, le hook ne s'execute jamais cote serveur

### Host
- Layout sur l'host pour eliminer les `<div>` wrappers : `host: { class: 'block p-6 ...' }`
- `[class.x]` / `[style.x]` / `(click)` dans `host` au lieu de `@HostBinding` / `@HostListener`

### Templates
- Control flow : `@if` / `@for` / `@switch` -- **jamais** `*ngIf` / `*ngFor`
- `track item.id` obligatoire, jamais `$index` sur liste mutable
- `@let` pour eviter lectures multiples et non-null assertions
- `[class]` / `[style]` > `NgClass` / `NgStyle`
- `NgOptimizedImage` obligatoire pour toute `<img>` (voir section dediee)
- Template literals (v20+) : `{{ \`Hello ${user().name}\` }}`

### NgOptimizedImage -- LCP / CLS
- Importer `NgOptimizedImage` dans le composant, utiliser `[ngSrc]="..."` -- **jamais** `<img src>` brut (pas de lazy auto, pas de srcset, CLS garanti)
- `width` + `height` = **dimensions intrinseques du fichier** (pas d'affichage). Reservent le ratio dans le HTML, suppriment le CLS
- CSS responsive : `width: 100%; height: auto;` -- le `height: auto` est **indispensable** pour conserver le ratio (sinon image etiree)
- `fill` quand le ratio est inconnu (CMS, conteneur variable) : parent **doit** avoir `position: relative` + `aspect-ratio` + `object-fit`, l'image se cale en absolu
- `priority` sur **l'unique image LCP par page** (hero, visuel above-the-fold). Pose `fetchpriority="high"` + `<link rel="preload">` + desactive lazy. Warning NG02955 en dev si oublie
- `ngSrcset="400w, 800w, 1200w, 1600w"` + `sizes="(max-width: 768px) 100vw, 50vw"` sur images responsive : le browser pioche la bonne variante selon viewport / densite
- `IMAGE_LOADER` token (ou loader CDN fourni : `provideImgixLoader`, `provideCloudinaryLoader`, etc.) configure dans `app.config.ts` : seul moyen d'obtenir resize + WebP/AVIF. Sans loader, `ngSrcset` ne sert a rien
- `alt=""` valide **uniquement** pour image purement decorative. Vignette / produit / banniere -> vrai texte alt (la directive ne le verifie pas, mais a11y et SEO si)

### Anti-patterns NgOptimizedImage
- **Plusieurs `priority` sur la meme page** : priorite diluee, sursollicitation bande passante. Une seule image LCP = un seul `priority`
- **`width`/`height` sans `height: auto` CSS** : image etiree, ratio perdu, CLS revient
- **`fill` sans parent positionne** : image echappe au flux (`position: relative` obligatoire)
- **`ngSrcset` sans `IMAGE_LOADER` configure** : Angular ne sait pas generer les variantes d'URL, le srcset reste mort
- **Ignorer les warnings dev NG029xx** : la directive est la premiere ligne d'audit avant Lighthouse -- console propre = score propre

### @defer
- **Utiliser pour** : sections under-the-fold, widgets non critiques, composants lourds derriere interaction
- **Jamais pour** : above-the-fold, contenu principal d'une route, SEO critique sans hydrate
- Toujours fournir `@placeholder` (skeleton CSS pur, dimensions identiques au composant final)
- `prefetch on idle` sur composants `on interaction` (chargement avance, affichage a la demande)
- `@error` obligatoire avec retry pour la resilience

### Zoneless (Angular 21+)
- Zoneless par defaut, **OnPush obligatoire**
- Pas de `setTimeout` ni `ChangeDetectorRef.detectChanges()` pour trigger CD
- Signals pour tout etat reactif

### Reactive Forms
- 1 form = 1 `FormGroup`, 1 champ = 1 `FormControl`, submit = `ngSubmit`
- Toujours typer le shape du form, `nonNullable: true` par defaut
- `getRawValue()` (inclut disabled), pas `.value`
- `FormGroup` imbrique pour les sections
- `<fieldset>` + `<legend>` pour grouper, `<label for>` toujours
- `aria-required="true"`, `role="alert"` sur les erreurs
- `control.updateValueAndValidity()` **obligatoire** apres changement dynamique de validators

### Routing
- Lazy load partout (`loadComponent`, `loadChildren`), **sauf** la route par defaut
- Constantes routes en `SCREAMING_CASE` (`ME_ROUTES`)
- `routerLink` relatif dans les features
- Params via `input.required<string>()` (`withComponentInputBinding()`)
- Guards / resolvers fonctionnels (`CanMatchFn`, `ResolveFn`, `CanDeactivateFn`)
- Intercepteurs fonctionnels (`HttpInterceptorFn`)

---

## Signals et RxJS

### Quand utiliser quoi
| Besoin | Outil |
|--------|-------|
| Etat local UI | `signal()` + `computed()` |
| Valeur derivee | `computed()` |
| Etat derive modifiable | `linkedSignal()` |
| Effet de bord (DOM, localStorage, analytics) | `effect()` |
| GET HTTP simple | `httpResource()` ou `rxResource()` |
| Flux async (debounce, retry, websocket) | RxJS + `toSignal()` |
| Pattern sandwich | Signal -> `toObservable` -> ops -> `toSignal` |

### Regles signals
- `.set()` / `.update()`, **jamais** `mutate`
- Toujours nouvelles references : `[...arr]`, `{...obj}`, `new Map(old)`
- Encapsuler : `private _x = signal(); x = this._x.asReadonly()`
- Dans les templates : `computed()` uniquement, **jamais** methodes ni getters

### Pieges `effect()` (tres restrictif)
- Si `effect()` lit puis `set()` un autre signal -> c'est un `computed()` deguise
- `effect()` dans service `providedIn: 'root'` -> capturer `EffectRef` + `DestroyRef.onDestroy(() => ref.destroy())`
- `untracked()` chirurgical OK ; repete = mauvais decoupage
- `effect()` differe au prochain CD -> jamais pour logique imperative sequentielle

### RxJS
- Imports depuis `'rxjs'` (pas `'rxjs/operators'`, deprecie v7+)
- Suffixe `$` pour Observables
- `takeUntilDestroyed()` sur tout subscribe manuel
- Preferer `async` pipe ou `toSignal()` a `subscribe`
- Ordre de filtrage : `debounceTime` -> `map(trim)` -> `filter` -> `distinctUntilChanged` -> `switchMap`

---

## CSS / TailwindCSS v4 (full Tailwind)

- **Tout en utility classes par defaut** dans les templates et `host: { class }`
- **Reutilisation = composant Angular**, pas `@apply` ni classe CSS custom (doc officielle Tailwind v4 : "for anything more complicated than a single HTML element, use template partials so the styles and structure can be encapsulated in one place")
- **Pas de fichier `.css` / `.scss` separe** pour les composants (sauf `styles.css` global et tokens `@theme`)
- **Pas de `styles: ` inline** sauf exceptions ci-dessous
- **CSS-first config v4** : `@theme`, `@utility`, `@custom-variant` dans `styles.css`. Pas de `tailwind.config.ts` sauf besoin specifique (plugin JS, extension complexe)
- Couleurs en OKLCH dans `@theme`, alpha via `color-mix(in srgb, var(--x) <alpha>%, transparent)`

### Exceptions ou le CSS inline est legitime
1. `@keyframes` custom (animations avec timing ou iterations non supportes par Tailwind)
2. Pseudo-elements complexes (`::before` / `::after` avec `radial-gradient`, `color-mix`, blur)
3. `background-clip: text` + `-webkit-text-fill-color` (gradient text)
4. `:autofill`, `::selection`, `::placeholder` avec styles avances

Hors exceptions : si tu hesites a creer un bloc `styles: `, **fais un composant `shared/ui/`**.

---

## Clean Architecture EAK (3 couches par feature)

```
src/app/features/<feature>/
├── domain/        # TS pur, zero dep framework
│   ├── models/    # type (pas interface)
│   ├── gateways/  # abstract class
│   └── use-cases/ # 1 methode execute()
├── infra/         # services Angular, HTTP, adapters
│   ├── http-*.gateway.ts
│   ├── *.adapter.ts        # fonctions pures
│   └── *.types.ts          # types API
└── application/   # composants dumb, tokens
```

Dossiers transverses : `core/` (singletons, interceptors, guards), `pages/` (smart), `layout/` (shell `<router-outlet />`), `shared/` (UI reutilisable, **pas de services**).

### Regle de dependance
- `application` -> `domain`
- `infra` -> `domain`
- `domain` -> **rien** (zero import Angular)
- `application` ne depend **jamais** directement de `infra` -- cablage dans `app.config.ts`

### Conventions
- Domain : pas de `@Injectable`, pas de `signal()`, pas de `inject()`. 1 use case = 1 `execute()` (SRP)
- Use case `@Injectable({ providedIn: 'root' })` accepte (pragmatisme)
- Adapter = fonction pure (`toAppointment(raw)`)
- Types API isoles dans `infra/` (jamais dans `domain`)
- Smart components injectent les use cases (ou directement le gateway si pas de use case), dumb components = `input()` + `output()` uniquement
- Chemins absolus : `@env/*`, `@core/*`, `@shared/*`, `@features/*`

### Quand creer un `abstract class` gateway ? (YAGNI)
- Abstract uniquement si **2+ implementations reelles** existent ou sont planifiees (in-memory + HTTP, mock + prod, multi-tenant)
- Une seule implementation HTTP -> **classe concrete `@Injectable({ providedIn: 'root' })` directe**, pas d'abstract
- La testabilite passe par `provideHttpClientTesting()`, pas par swap de gateway

### Quand creer un use case ? (anti-trivial)
- Un use case doit contenir de la **logique metier** : validation, orchestration, transformation, gestion d'erreur Result pattern, composition de gateways
- **Anti-pattern** : `execute() { return this._gateway.getX(); }` (passthrough trivial). Le composant smart consomme directement le gateway via `inject()`
- **Regle pratique** : si le use case n'ajoute pas de sens metier, supprime-le et appelle le gateway directement

### Cablage
```ts
providers: [{ provide: AppointmentGateway, useClass: HttpAppointmentGateway }]
```

---

## Backend -- NestJS + PostgreSQL + Drizzle + Zod

> ⚠️ **Repo separe** : le backend vit dans `nest-dashflow-app` (depot distinct), **pas** dans ce repo frontend. Aucun `apps/api/**` ici, pas de monorepo. Cette section sert de reference quand on travaille dans le repo backend ; les chemins ci-dessous sont relatifs a `nest-dashflow-app`.

### Structure NestJS
```
src/
├── modules/<feature>/
│   ├── <feature>.module.ts
│   ├── <feature>.controller.ts   # routes + DTO validation Zod
│   ├── <feature>.service.ts      # logique metier
│   ├── <feature>.repository.ts   # acces Drizzle
│   ├── dto/                      # Zod schemas + types inferes
│   └── *.spec.ts
├── db/
│   ├── schema/                   # Drizzle tables
│   ├── migrations/               # genere par drizzle-kit
│   └── index.ts                  # client db
└── common/                       # guards, pipes, filters, interceptors
```

### Drizzle
- Schemas typees dans `db/schema/<feature>.ts`
- Types inferes : `type User = typeof users.$inferSelect`, `type NewUser = typeof users.$inferInsert`
- Migrations generees : `drizzle-kit generate` (jamais a la main)
- Repository pattern : `db.select().from(users).where(eq(users.id, id))`
- Relations explicites via `relations()` pour les `findMany({ with: { ... } })`
- Pas de raw SQL sauf optimisation prouvee

### Zod aux frontieres
- 1 schema Zod par DTO d'entree (body, query, params)
- Type infere : `type CreateUserDto = z.infer<typeof CreateUserSchema>`
- `ZodValidationPipe` (NestJS) sur chaque controller
- Schema partage front/back via package commun si monorepo
- Sortie : DTO de reponse explicite, **jamais** l'entite Drizzle directe (fuite de schema BDD)

### Gateway Angular <-> NestJS
- `HttpClient` type sur les DTOs partages
- Adapter cote front : DTO API -> modele domain
- Intercepteur fonctionnel pour `Authorization: Bearer <token>`
- Erreurs HTTP -> Result pattern dans le use case

---

## Tests Vitest

- Fichier `.spec.ts`, pattern `describe` > `it` Given/When/Then
- 3 niveaux : unitaire (tout mocke), composant (TestBed + mocks), integration (chaine complete)
- Domain teste **sans TestBed** (TypeScript pur)
- `it.each` pour la triangulation TDD (anti faux-positifs)
- `defer(() => of(data))` pour simuler async dans les fakes
- Composant : `TestBed.overrideComponent` > `configureTestingModule`
- Inputs : `fixture.componentRef.setInput('name', value)`
- Selecteurs : `data-testid="x"`, **jamais** id / class / texte
- HTTP : `provideHttpClientTesting()` + `HttpTestingController` + `verify()` en afterEach
- Builder + PageModel pour la lisibilite

---

## A11y / SEO / Performance

- WCAG AA, doit passer AXE
- HTML semantique : `<button>` actions, `<a routerLink>` nav, `<section aria-labelledby>`, `<nav aria-label>`, `<fieldset>` + `<legend>`
- Un seul `<h1>` par page, jamais sauter de niveau
- `focus-visible` > `focus`
- `Title` + `Meta` pour SEO ; preconnect aux origins critiques
- SSR pour le pre-rendu des pages publiques (`provideClientHydration()`)
- Lazy loading via `loadComponent` / `loadChildren` partout (sauf route par defaut)
- `NgOptimizedImage` + `priority` sur LCP, `width` + `height` explicites
- Eviter barrel imports (`index.ts`) -- empechent le tree-shaking
- Virtual scrolling (`CdkVirtualScrollViewport`) pour listes > 100 elements

---

## Workflow Claude (methode Boris Cherny)

1. **Plan mode** pour toute tache non triviale (3+ etapes ou decision archi). Si derive -> STOP et replanifier.
2. **Subagents liberalement** pour recherche, exploration, analyse parallele. Garde le contexte principal propre.
3. **Self-improvement loop** : apres chaque correction utilisateur, mise a jour `tasks/lessons.md` ET du CLAUDE.md (cf. Auto-revision).
4. **Verification before done** : prouver que ca marche (tests, logs, comportement diff). Ne jamais marquer "done" sans preuve.
5. **Demand elegance** sur les changements non triviaux ("y a-t-il plus elegant ?").
6. **Autonomous bug fixing** : un rapport de bug = je fixe, je n'attends pas qu'on me tienne la main.

### Task management
1. Plan dans `tasks/todo.md` (cases a cocher)
2. Validation du plan avant impl
3. Suivi de progression au fil de l'eau
4. Resume haut-niveau a chaque etape majeure
5. Section review en fin
6. Lessons capturees dans `tasks/lessons.md`

### Principes fondamentaux
- **Simplicite d'abord** -- impact minimal
- **Pas de laxisme** -- root cause, jamais de fix temporaire
- **YAGNI**, **SRP**, **Screaming Architecture**, **Immutabilite**, **Pragmatisme > purete**
- Framework agnosticism dans le domain (RxJS OK, decorators Angular non)

---

## Auto-revision de CLAUDE.md

**Regle** : a chaque correction utilisateur sur une convention, un pattern, une preference ou une decision d'architecture, proposer immediatement un patch CLAUDE.md avant de continuer la tache en cours.

### Declencheurs (mots-cles)
"non, pas comme ca", "plutot", "prefere", "toujours", "jamais", "a partir de maintenant", "desormais", "corrige ca", "ne fais plus", "on utilise X maintenant".

### Protocole
1. **Detecter** la correction
2. **Localiser** la section CLAUDE.md concernee (ou identifier qu'il faut une nouvelle section)
3. **Consulter la doc officielle** correspondante via `WebFetch` / `WebSearch` pour valider la coherence (voir Sources)
4. **Cas A -- la correction est coherente avec la doc** :
   - Proposer le diff precis : `Mise a jour CLAUDE.md (section X) : <diff>`
   - Sur accord utilisateur -> edition + commit `docs(claude): update <section>`
5. **Cas B -- la correction contredit la doc officielle** :
   - Challenger respectueusement avec citation et lien
   - Demander confirmation explicite avant patch
6. **Cas C -- refus utilisateur du patch** :
   - Entree datee dans `tasks/lessons.md` (retention session)

### Sources officielles a consulter
| Domaine | URL canonique |
|---------|---------------|
| Angular | https://angular.dev |
| Angular AI | https://angular.dev/ai |
| Angular RFC style guide 2025 | https://github.com/angular/angular/discussions/59522 |
| NestJS | https://docs.nestjs.com |
| Drizzle ORM | https://orm.drizzle.team/docs/overview |
| Drizzle Kit | https://orm.drizzle.team/docs/kit-overview |
| Zod | https://zod.dev |
| TypeScript | https://www.typescriptlang.org/docs/handbook |
| RxJS | https://rxjs.dev |
| TailwindCSS v4 | https://tailwindcss.com/docs |
| Vitest | https://vitest.dev |

### Garde-fous
- Une seule regle modifiee par patch (atomique, reviewable)
- Pas de reecriture massive sans demande explicite
- Si la meme correction revient 2x -> patch urgent
- Mise a jour des memories (`~/.claude/projects/.../memory/`) en parallele si pertinent
- Ne jamais inventer une regle qui contredit la doc officielle sans justification ecrite dans CLAUDE.md

---

## Commandes

```bash
# Frontend Angular
pnpm start                  # Dev server
pnpm build                  # Build production
pnpm test                   # Vitest
pnpm ng generate            # Schematics

# Backend NestJS -- repo separe `nest-dashflow-app` (commandes a lancer la-bas)
pnpm start:dev              # Dev API
pnpm drizzle-kit generate   # Generer migration depuis schema
pnpm drizzle-kit migrate    # Appliquer migrations
pnpm drizzle-kit studio     # UI inspection BDD
```

## Ressources
- [Angular](https://angular.dev) · [NestJS](https://docs.nestjs.com) · [Drizzle](https://orm.drizzle.team) · [Zod](https://zod.dev) · [RxJS](https://rxjs.dev) · [Vitest](https://vitest.dev)
- Skills locales : `~/.claude/skills/`
- Conventions EAK : `~/Documents/Obsidian Vault/EAK - Easy Angular Kit/`
