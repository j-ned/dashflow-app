# RxJS Interop Angular — Reference

## toSignal (Observable → Signal)

```typescript
import { toSignal } from '@angular/core/rxjs-interop';

// Avec initialValue — le type inclut la valeur initiale
const count = toSignal(count$, { initialValue: 0 });
// Signal<number>

// Sans initialValue — le type inclut undefined
const count = toSignal(count$);
// Signal<number | undefined>

// requireSync pour BehaviorSubject (pas besoin d'initialValue)
const count = toSignal(count$, { requireSync: true });
// Signal<number> — lance une erreur si l'Observable n'emet pas synchronement
```

### Comportement

- Subscribe **immediatement** a l'Observable — peut declencher des side effects
- Se desinscrit **automatiquement** a la destruction du composant/service
- Les erreurs sont **thrown** quand on lit le signal apres une erreur
- `manualCleanup: true` pour les Observables qui se completent seuls (evite de garder la subscription)

```typescript
// manualCleanup pour un Observable qui se complete
const result = toSignal(
  this.http.get<Data>('/api/data'),
  { initialValue: null, manualCleanup: true }
);
```

### Gestion d'erreurs

```typescript
// Les erreurs propagent quand on lit le signal
const data = toSignal(data$.pipe(
  catchError(() => of(fallbackValue))  // gerer avant toSignal
), { initialValue: null });
```

## toObservable (Signal → Observable)

```typescript
import { toObservable } from '@angular/core/rxjs-interop';

const query = signal('');
const query$ = toObservable(query);

// Combiner avec des operateurs RxJS
const results$ = query$.pipe(
  debounceTime(300),
  distinctUntilChanged(),
  switchMap(q => this.http.get<Result[]>(`/search?q=${q}`)),
);
```

### Comportement

- Utilise un `ReplaySubject(1)` interne
- La premiere emission peut etre synchrone, les suivantes sont **async** (via `microtask`)
- Ne re-emet que si la valeur change (basee sur l'egalite du signal)

## Pattern sandwich

Signal → `toObservable` → operateurs RxJS → `toSignal` → template

```typescript
export class SearchComponent {
  // 1. Signal d'entree (etat UI)
  protected readonly query = signal('');

  // 2. toObservable → operateurs RxJS → toSignal
  protected readonly results = toSignal(
    toObservable(this.query).pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(q => q.length >= 2),
      switchMap(q => this.searchService.search(q)),
    ),
    { initialValue: [] },
  );
}
```

```html
<!-- 3. Template utilise le signal directement -->
<input (input)="query.set($event.target.value)" />
@for (result of results(); track result.id) {
  <div>{{ result.name }}</div>
}
```

## takeUntilDestroyed

```typescript
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
```

### Dans le constructeur (injection context)

```typescript
export class MyComponent {
  constructor() {
    source$.pipe(
      takeUntilDestroyed(),
    ).subscribe(value => {
      // automatiquement desinscrit a la destruction
    });
  }
}
```

### Dans ngOnInit (hors injection context)

```typescript
export class MyComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit() {
    source$.pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(value => {
      // ...
    });
  }
}
```

### Dans un service

```typescript
@Injectable({ providedIn: 'root' })
export class SyncService {
  constructor() {
    interval(5000).pipe(
      takeUntilDestroyed(),
      switchMap(() => this.http.get('/api/sync')),
    ).subscribe();
  }
}
```

## rxResource (experimental)

```typescript
import { rxResource } from '@angular/core/rxjs-interop';

export class UserComponent {
  readonly userId = input.required<string>();

  private readonly userResource = rxResource({
    params: () => ({ userId: this.userId() }),
    stream: ({ params }) => this.userService.getUser(params.userId),
  });

  // Utilisation dans le template
  protected readonly user = this.userResource.value;
  protected readonly isLoading = this.userResource.isLoading;
  protected readonly error = this.userResource.error;
}
```

```html
@if (isLoading()) {
  <p>Chargement...</p>
} @else if (error(); as err) {
  <p>Erreur : {{ err.message }}</p>
} @else if (user(); as user) {
  <h1>{{ user.name }}</h1>
}
<button (click)="userResource.reload()">Rafraichir</button>
```

### Proprietes de ResourceRef

| Propriete | Type | Description |
|-----------|------|-------------|
| `value()` | `T \| undefined` | Valeur actuelle |
| `hasValue()` | `boolean` | Si une valeur existe |
| `isLoading()` | `boolean` | Si en chargement |
| `error()` | `unknown` | Erreur si le loader a echoue |
| `status()` | `ResourceStatus` | Status actuel |
| `reload()` | `void` | Relancer manuellement |
| `set()` / `update()` | — | Modifier la valeur localement |

## outputFromObservable / outputToObservable

```typescript
import { outputFromObservable, outputToObservable } from '@angular/core/rxjs-interop';

// Observable → Output (dans un composant)
readonly tick = outputFromObservable(interval(1000));

// Output → Observable (depuis un parent, rarement utilise)
const obs$ = outputToObservable(childComponent.someOutput);
```

## Conventions EAK

- Suffixe `$` pour les Observables : `users$`, `click$`
- Pas de suffixe pour les Signals : `users`, `isLoading`
- Preferer `toSignal()` ou `| async` a `subscribe()` imperatif
- Imports depuis `'rxjs'` directement (pas `'rxjs/operators'`)
- `defer(() => of(data))` pour les services in-memory simulant l'async
- `BehaviorSubject` pour les observables stateful dans les services
- `shareReplay({ bufferSize: 1, refCount: true })` pour partager un Observable entre plusieurs subscribers
