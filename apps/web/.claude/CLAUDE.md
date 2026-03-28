
You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

---

## Conventions de code

### Langue et nommage

- **Langue du code** : anglais (variables, fonctions, classes, commits, modeles domain)
- **Langue de communication** : francais
- **Commits** : Conventional Commits (feat:, fix:, refactor:, docs:, chore:)
- **Pas de code mort** : supprimer, pas commenter

---

## TypeScript

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain
- `type` pour les modeles de donnees (pas `interface` — pas de declaration merging)
- `interface` pour les contrats a implementer (gateways)
- Union types plutot que enums : `type Gender = 'male' | 'female' | 'none'`

---

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

---

## Angular — Composants

- Keep components small and focused on a single responsibility (SRP)
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.
- Classe : PascalCase + suffixe `Component` (ex: `PeopleListComponent`)
- Selecteur : prefixe `app-` + kebab-case (ex: `app-people-list`)
- Fichier : kebab-case + `.component.ts`
- Balises auto-fermantes : `<app-hello />`
- SFC (Single File Component) privilegie : inline template + inline styles, `template` en dernier
- Visibilite : `private` pour les services injectes, `protected` pour les proprietes liees au template, `readonly` pour signals/inputs/outputs
- Prefer Reactive forms instead of Template-driven ones

### Inputs / Outputs (signal-based)

```typescript
// Inputs
readonly value = input(0);                    // avec default, type infere
readonly content = input.required<string>();   // requis, type explicite

// Outputs
readonly valueChange = output<number>();      // suffixe Change = two-way binding [(value)]
```
- Toujours `readonly` — ne jamais reassigner un input signal
- `computed()` pour deriver des valeurs depuis les inputs
- Ne jamais reutiliser des noms d'evenements natifs

### Smart vs Dumb

- **Smart** (pages/containers) : connaissent les use cases, orchestrent via `input`/`output`
- **Dumb** (presentational) : recoivent les donnees via `input()`, zero injection de service
- `toSignal()` pour convertir Observable en Signal a la frontiere du composant
- `@let` dans les templates pour eviter les lectures multiples et les non-null assertions

---

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.
- `@if` / `@else if` / `@else` — remplace `*ngIf`
- `@for (item of items(); track item.id)` — `track` obligatoire, ID unique prefere, `$index` en fallback
- `@empty` pour les listes vides
- `@switch` pour les valeurs discretes uniquement
- Variables disponibles : `$index`, `$first`, `$last`, `$even`, `$odd`, `$count`

---

## State Management — Signals et reactivite

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

### APIs de base

| API | Usage | Ecriture |
|-----|-------|----------|
| `signal()` | Etat mutable | `.set()`, `.update()` |
| `computed()` | Valeur derivee | Read-only, recalcul auto |
| `effect()` | Side effects | Utiliser avec parcimonie |
| `linkedSignal()` | Derive mais writable | Read/Write, lie a la source |

### Signals vs RxJS

- **Signals** : etat synchrone, etat UI, etat local, derivations simples
- **RxJS** : flux async, HTTP, WebSocket, operateurs temporels (debounce, retry), streams complexes
- **Interop** : `toSignal()` (Observable→Signal), `toObservable()` (Signal→Observable)
- **Pattern sandwich** : Signal → toObservable → operateurs RxJS → toSignal → template

### Resource API (v19+)

| API | Input | Usage |
|-----|-------|-------|
| `resource()` | Promise | Async generique avec gestion d'etat |
| `rxResource()` | Observable | Reutiliser les services HttpClient existants |
| `httpResource()` | URL string | GET HTTP simple, one-liner |

Toutes retournent `ResourceRef` : `value()`, `isLoading()`, `error()`, `status()`, `reload()`.

### Immutabilite obligatoire

Les signals detectent par **reference** — toujours creer de nouvelles references :
- Arrays : `[...current, newItem]` (jamais `.push()`)
- Objects : `{ ...obj, prop: newValue }`
- Maps : `new Map(old)` puis `.set()`

---

## Services et DI

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection
- `inject()` uniquement en contexte d'injection (champ de classe, constructeur, factory)
- Convention Observable : suffixe `$` (ex: `users$`)

---

## Clean Architecture (EAK — 3 couches par feature)

### Structure

```
src/app/features/<feature>/
  ├── domain/             # TypeScript pur, zero dependance framework
  │   ├── models/         # Types de donnees (type, pas interface)
  │   ├── gateways/       # Contrats (interface ou abstract class)
  │   └── use-cases/      # Logique metier, 1 use case = 1 methode execute()
  ├── infra/              # Services Angular, communication externe
  │   ├── in-memory-*.gateway.ts
  │   ├── http-*.gateway.ts
  │   ├── *.adapter.ts    # Fonctions pures de transformation
  │   └── *.types.ts      # Types API specifiques (jamais dans domain)
  └── application/        # Couche UI
      ├── components/     # Dumb components (presentational)
      └── tokens/         # InjectionToken (optionnel)
```

### Regle de dependance

- **Application** depend de **Domain** (utilise les use cases)
- **Infra** depend de **Domain** (implemente les gateways)
- **Domain** depend de **rien** — zero import Angular, zero couplage framework
- **Application** ne depend JAMAIS directement d'**Infra**

### Domain

- Pas de `@Injectable`, pas de `signal()`, pas de `inject()` — TypeScript + RxJS uniquement
- Chaque use case a une seule methode `execute()` (SRP)
- Le domain definit la forme ideale des donnees, les adapters (infra) gerent la transformation
- Modeles en anglais meme si l'UI est en francais

```typescript
// Use case pattern
export class GetPeopleUseCase {
  constructor(private readonly _gateway: GetPeopleGateway) {}
  execute(): Observable<People[]> {
    return this._gateway.getPeople();
  }
}
```

### Infra

- Gateways concrets avec `@Injectable()` + `implements GatewayInterface`
- In-memory : `BehaviorSubject` + `defer()` pour simuler l'async
- HTTP : `inject(HttpClient)` + `pipe(map(adapter))`
- Adapters = fonctions pures, pas des classes
- Types API dans `infra/` uniquement (ex: `swapi.types.ts`)

```typescript
// Adapter pattern
export function toPeople(raw: SwapiPeople): People {
  return {
    name: raw.name,
    height: parseInt(raw.height, 10) || 0,
    skills: raw.skills.split(', ').filter(Boolean),
    gender: raw.gender as Gender,
  };
}
```

### InjectionToken (puriste)

```typescript
// domain: interface GetPeopleGateway { ... }
// tokens: export const GET_PEOPLE_GATEWAY = new InjectionToken<GetPeopleGateway>('...');
// app.config.ts: { provide: GET_PEOPLE_GATEWAY, useClass: InMemoryPeopleGateway }
```

### Switch d'implementation

```typescript
// app.config.ts — une seule ligne a changer
providers: [
  { provide: GetPeopleGateway, useClass: HttpPeopleGateway },
]
// Ou par environnement :
// useClass: environment.production ? HttpGateway : InMemoryGateway
```

---

## Reactive Forms

- 1 form HTML = 1 `FormGroup`, 1 champ = 1 `FormControl`, submit = `ngSubmit`
- Toujours typer : `type IdentityForm = { firstName: FormControl<string>; ... }`
- `nonNullable: true` sur les controls qui ne doivent jamais etre null
- `getRawValue()` au lieu de `.value` (inclut les champs disabled)
- `FormGroup` imbrique pour les formulaires multi-sections
- CSS : `.ng-invalid.ng-touched` pour l'affichage conditionnel des erreurs
- `[disabled]="form.invalid"` sur le bouton submit

---

## Routing

### Lazy loading

- `loadComponent` pour un composant seul
- `loadChildren` pour les routes de feature
- **Ne jamais lazy-loader la route par defaut** — elle doit charger instantanement
- Constantes de routes en SCREAMING_CASE : `ME_ROUTES`, `ADMIN_ROUTES`
- `routerLink` relatif dans les features (ex: `routerLink="drafts"` pas `/me/drafts`)

### Guards (fonctionnels, Angular 15+)

- `CanMatchFn` — bloque le matching de route, retourne `UrlTree` pour redirect
- `CanDeactivateFn<HasDirtyForm>` — empeche de quitter avec des changements non sauvegardes
- Guards = fonctions avec `inject()`, pas des classes

### Resolvers

- `ResolveFn<T>` — precharge les donnees avant activation du composant
- `withComponentInputBinding()` mappe les donnees resolues vers les inputs du composant par nom de cle

### Providers au niveau route

```typescript
{
  path: 'me',
  loadChildren: () => import('./features/me/me.routes').then(m => m.ME_ROUTES),
  providers: [{ provide: UserGateway, useClass: HttpUserGateway }],
}
```

---

## HttpClient

```typescript
// app.config.ts
providers: [
  provideHttpClient(withFetch()),       // withFetch() recommande pour SSR
  // withInterceptors([...]) pour auth, logging, etc.
]
```

---

## Tests (Vitest — conventions EAK)

### Structure

- Fichier : `.spec.ts`
- Pattern : `describe` > `it` avec Given/When/Then (AAA)
- Run : `ng test --watch`

### Types de tests

| Type | Scope | Dependances |
|------|-------|-------------|
| **Unitaire** | TypeScript seul, un comportement | Tout mocke |
| **Composant** | TypeScript + HTML, un comportement | Tout mocke |
| **Integration** | TypeScript + HTML, traverse les couches | Non mocke |

### Test doubles

- **Stub** : donnees fixes, pas de logique — `{ getBooks: vi.fn().mockReturnValue(of(data)) }`
- **Fake** : implementation simplifiee complete — `InMemoryBookGateway`
- **Mock** : spy qui enregistre les appels — `vi.fn()` + `toHaveBeenCalledWith()`

### Test du domain (sans TestBed)

```typescript
it.each([
  { books: [{ id: 1, title: 'Clean Code' }] },
  { books: [{ id: 42, title: 'Design Patterns' }] },
])('should return books', ({ books }) => {
  const gateway: GetBooksGateway = { getBooks: () => defer(() => of(books)) };
  const useCase = new GetBooksUseCase(gateway);
  let result: Book[];
  useCase.execute().subscribe(res => (result = res));
  expect(result).toEqual(books);
});
```
- `it.each` pour la triangulation TDD — empeche les faux positifs
- `toEqual` pour la comparaison profonde, `toBe` pour les primitives
- `defer(() => of(data))` pour simuler le timing async

### Test de composant (avec TestBed)

```typescript
TestBed.overrideComponent(Component, {
  set: {
    providers: [{ provide: TOKEN, useValue: stub }],
    imports: [],
    schemas: [NO_ERRORS_SCHEMA],
  },
}).createComponent(Component);
```
- `overrideComponent` prefere a `configureTestingModule` pour l'isolation
- `fixture.detectChanges()` pour declencher le rendu
- `fixture.componentRef.setInput('name', value)` pour les inputs en tests
- Signals = synchrones, pas besoin de `fakeAsync`/`tick`/`whenStable`

### Selecteurs de test

- Attribut `datatest-id="people-item"` pour les selecteurs de test
- Pas `id` (unicite), pas `class` (CSS), pas le contenu texte (fragile)
- Query : `querySelectorAll('[datatest-id="people-item"]')`

### Patterns utilitaires

**PageModel** — encapsule les queries DOM :
```typescript
class BookEditPageModel {
  constructor(private readonly fixture: ComponentFixture<BookEditComponent>) {}
  get titleInput() { return this.fixture.debugElement.query(By.css('#title')); }
  typeTitle(value: string): void {
    this.titleInput.nativeElement.value = value;
    this.titleInput.triggerEventHandler('input', { target: this.titleInput.nativeElement });
    this.fixture.detectChanges();
  }
}
```

**Builder** — centralise la creation de donnees de test :
```typescript
class BookBuilder {
  private entity: Book = { id: 1, title: 'Default' };
  static default(): BookBuilder { return new BookBuilder(); }
  with<K extends keyof Book>(key: K, value: Book[K]): BookBuilder {
    this.entity[key] = value; return this;
  }
  build(): Book { return { ...this.entity }; }
}
```

---

## Principes generaux (EAK)

- **YAGNI** — ne pas ajouter de parametres/features avant d'en avoir besoin
- **SRP** — chaque use case fait une chose, chaque composant a une responsabilite
- **Screaming Architecture** — les noms de dossiers revelent l'intention sans ouvrir les fichiers
- **Immutabilite** — toujours de nouvelles references pour les mises a jour d'etat
- **Framework agnosticism dans le domain** — RxJS OK (c'est du TypeScript), decorators Angular non
- **Pragmatisme > purete** — adapter la rigueur architecturale a la taille de l'equipe et la duree du projet

---

## Claude Workflow (Boris Cherny method)

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.

---

## Reference skills

Les documents de reference, cours, tips et docs sont dans les dossiers ci-dessous.
Consulter le fichier pertinent quand une question touche a une techno documentee.
Source conventions Angular : EAK (Easy Angular Kit) dans `~/Documents/Obsidian Vault/EAK - Easy Angular Kit/`.

### HTML — `~/Documents/Obsidian Vault/Claude/skills/html/`
- `01-structure.md` — Structure HTML de base
- `02-semantique.md` — Balises semantiques
- `03-formulaires.md` — Formulaires HTML
- `04-media.md` — Images, video, audio
- `05-tableaux-liens.md` — Tableaux et liens
- `06-accessibilite.md` — Accessibilite HTML (ARIA)
- `07-data-attributs.md` — Attributs data-*

### CSS — `~/Documents/Obsidian Vault/Claude/skills/css/`
- `01-selecteurs.md` — Selecteurs CSS
- `02-box-model.md` — Box model
- `03-flexbox.md` — Flexbox
- `04-grid.md` — CSS Grid
- `05-positionnement.md` — Positionnement
- `06-typographie.md` — Typographie
- `07-couleurs-fonds.md` — Couleurs et fonds
- `08-animations.md` — Animations CSS
- `09-responsive.md` — Responsive design
- `10-variables-fonctions.md` — Variables et fonctions CSS

### TypeScript — `~/Documents/Obsidian Vault/Claude/skills/typescript/`
- `01-types-base.md` — Types de base
- `02-fonctions.md` — Fonctions
- `03-objets-interfaces.md` — Objets et interfaces
- `04-unions-narrowing.md` — Unions et narrowing
- `05-generics.md` — Generics
- `06-utility-types.md` — Utility types
- `07-mapped-types.md` — Mapped types
- `08-classes.md` — Classes
- `09-patterns.md` — Patterns TypeScript
- `10-config.md` — Configuration tsconfig

### Angular — `~/Documents/Obsidian Vault/Claude/skills/angular/`
- `01-composants.md` — Composants
- `02-signals.md` — Signals
- `03-rxjs-interop.md` — RxJS interop
- `04-resource-api.md` — Resource API
- `05-control-flow.md` — Control flow (@if, @for, @switch)
- `06-dependency-injection.md` — Dependency injection
- `07-clean-architecture.md` — Clean architecture EAK
- `08-reactive-forms.md` — Reactive forms
- `09-http-client.md` — HttpClient
- `10-routing.md` — Routing
- `11-tests-vitest.md` — Tests Vitest
- `12-defer.md` — @defer
- `13-signal-forms.md` — Signal forms
- `14-host-elements.md` — Host elements
- `15-animations.md` — Animations
- `16-angular-aria.md` — Angular Aria (accessibilite)
- `17-cli.md` — Angular CLI
- `18-rendering-strategies.md` — Rendering strategies (SSR, SSG)
- `19-component-styling.md` — Component styling