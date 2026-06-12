# Signals Angular — Reference

## APIs de base

### signal() — etat writable

```typescript
const count = signal(0);

count();              // lire la valeur : 0
count.set(3);         // ecrire une nouvelle valeur
count.update(v => v + 1); // updater a partir de la valeur courante
count.asReadonly();    // exposer en lecture seule (Signal<number>)
```

### computed() — valeur derivee, read-only, lazy, memoized

```typescript
const count = signal(0);
const double = computed(() => count() * 2);
// double() === 0
// count.set(5);
// double() === 10
```

- Ne se recalcule que si les dependances changent
- Les dependances sont trackees automatiquement
- Peut dependre d'autres `computed()`

### effect() — side effects

```typescript
effect(() => {
  console.log(`Count changed to: ${count()}`);
});
```

- Execute au moins une fois
- Se re-execute quand les signals lus changent
- Asynchrone pendant la detection de changements
- A utiliser avec parcimonie — preferer `computed()` pour la derivation

### linkedSignal() — derive mais writable (Angular 19+)

Repond a un besoin precis : un signal **writable** dont la valeur se recalcule automatiquement quand une dependance change, mais que l'utilisateur peut modifier entre deux recalculs. `computed()` ne suffit pas (read-only), `signal()` + `effect()` est un anti-pattern (cf. plus bas).

#### Forme courte — reset simple

```typescript
const category = signal('all');

// selectedProduct revient a null chaque fois que category change,
// mais reste writable : selectedProduct.set(product) fonctionne
readonly selectedProduct = linkedSignal<Product | null>(() => {
  this.category();   // declare la dependance
  return null;       // valeur retournee a chaque changement de source
});
```

#### Forme longue — acces a la valeur precedente

```typescript
readonly selectedProduct = linkedSignal<Product | null>({
  source: this.filteredProducts,
  computation: (products, previous) => {
    // previous: { value: T } | undefined (undefined a la 1re execution)
    const prev = previous?.value;
    // Garder la selection si elle est toujours dans la liste filtree
    if (prev && products.find(p => p.id === prev.id)) return prev;
    return products[0] ?? null;
  },
});
```

Le paramètre `previous` est un objet `{ value: T }` (et non la valeur directe) pour distinguer `undefined` (pas de valeur precedente) de `{ value: undefined }` (la valeur precedente etait undefined).

#### Cas d'usage typiques

| Pattern | Code |
|---------|------|
| Pagination : `currentPage` revient a 1 quand le filtre change | `linkedSignal(() => { filter(); return 1; })` |
| Selection : reset brutal quand la liste change | Forme courte avec `return null` |
| Selection : preservation intelligente si encore valide | Forme longue avec `previous?.value` |
| Form state : reinitialise quand l'entite chargee change | Forme longue, calcul depuis l'entite |

#### Quand utiliser quoi

| Besoin | Outil |
|--------|-------|
| Derive read-only | `computed()` |
| Etat independant modifiable | `signal()` |
| Derive **ET** modifiable (reset auto sur dependance) | `linkedSignal()` |
| Side effect vers API externe (DOM, localStorage, URL...) | `effect()` |

## Immutabilite obligatoire

Les signals detectent les changements **par reference**. Il faut toujours creer de nouvelles references :

```typescript
// Arrays — JAMAIS .push(), .splice(), .sort() en place
const items = signal<string[]>(['a', 'b']);
items.update(current => [...current, 'c']);           // ajouter
items.update(current => current.filter(i => i !== 'b')); // supprimer
items.update(current => current.map(i => i === 'a' ? 'A' : i)); // modifier

// Objects — JAMAIS de mutation directe
const user = signal({ name: 'Alice', age: 30 });
user.update(u => ({ ...u, age: 31 }));

// Maps — creer une nouvelle Map
const cache = signal(new Map<string, number>());
cache.update(old => new Map(old).set('key', 42));

// Sets — creer un nouveau Set
const tags = signal(new Set<string>());
tags.update(old => new Set(old).add('angular'));
```

## Custom equality

Par defaut, les signals utilisent `Object.is()`. On peut fournir une fonction d'egalite custom :

```typescript
import { isEqual } from 'lodash-es';

const data = signal(['test'], { equal: isEqual });
// Ne notifie pas si la nouvelle valeur est deep-equal a l'ancienne
```

```typescript
// Egalite custom pour un type specifique
const position = signal(
  { x: 0, y: 0 },
  { equal: (a, b) => a.x === b.x && a.y === b.y }
);
```

## Effect cleanup

```typescript
effect((onCleanup) => {
  const timer = setTimeout(() => doSomething(), 1000);
  onCleanup(() => clearTimeout(timer));
});
```

- `onCleanup` est appele **avant** chaque re-execution et a la destruction
- Utile pour annuler des timers, AbortController, event listeners

```typescript
effect((onCleanup) => {
  const controller = new AbortController();
  fetch(`/api/search?q=${query()}`, { signal: controller.signal });
  onCleanup(() => controller.abort());
});
```

## afterRenderEffect

```typescript
constructor() {
  afterRenderEffect(() => {
    chart.updateData(chartData());
  });
}
```

Phases (executees dans l'ordre) :

| Phase | Usage |
|-------|-------|
| `earlyRead` | Lire le DOM avant les ecritures |
| `write` | Ecrire dans le DOM |
| `mixedReadWrite` | Defaut — a eviter (cause des layout thrashing) |
| `read` | Lire le DOM apres les ecritures |

```typescript
afterRenderEffect({
  earlyRead: () => {
    return elementRef.nativeElement.offsetHeight;
  },
  write: (height) => {
    otherElement.style.height = `${height}px`;
  },
});
```

## Quand utiliser quoi

| Besoin | Utiliser |
|--------|----------|
| Etat synchrone, UI, local | `signal()` |
| Valeur derivee | `computed()` |
| Derive mais writable | `linkedSignal()` |
| Side effect | `effect()` (avec parcimonie) |
| Flux async, HTTP, WebSocket | RxJS |
| Operateurs temporels (debounce, retry, merge) | RxJS |
| Etat reactive cross-component | Service avec signals |

## Service pattern avec signals (EAK)

```typescript
@Injectable({ providedIn: 'root' })
export class FruitService {
  private readonly fruits = signal<string[]>(['pomme', 'banane', 'orange']);

  // Exposer en lecture seule
  getRemainingFruits(): Signal<string[]> {
    return this.fruits.asReadonly();
  }

  // Mutations
  eatOne(fruit: string): void {
    this.fruits.update(current => current.filter(f => f !== fruit));
  }

  addFruit(fruit: string): void {
    this.fruits.update(current => [...current, fruit]);
  }
}
```

```typescript
// Dans un composant
export class FruitListComponent {
  private readonly fruitService = inject(FruitService);
  protected readonly fruits = this.fruitService.getRemainingFruits();

  protected eat(fruit: string) {
    this.fruitService.eatOne(fruit);
  }
}
```

## Anti-patterns

### Ne pas utiliser effect() pour propager de l'etat

```typescript
// MAUVAIS — utiliser computed() a la place
effect(() => {
  this.fullName.set(this.firstName() + ' ' + this.lastName());
});

// BON
readonly fullName = computed(() => this.firstName() + ' ' + this.lastName());
```

### Ne pas utiliser effect() pour resetter un signal sur changement d'un autre signal

```typescript
// MAUVAIS — effect() utilise pour synchroniser de l'etat interne
readonly category = signal('all');
readonly selectedProduct = signal<Product | null>(null);

constructor() {
  effect(() => {
    this.category();                  // declare la dependance
    this.selectedProduct.set(null);   // re-ecriture imperative d'un signal
  });
}
```

Problemes :
- Ordre d'execution non garanti par rapport aux autres effects
- `effect()` est concu pour les side effects vers APIs **externes**, pas pour synchroniser des signals entre eux
- Depuis Angular 19, le flag `allowSignalWrites` a ete retire — plus aucun garde-fou

```typescript
// BON — linkedSignal : declaratif, ordre garanti, intention explicite
readonly selectedProduct = linkedSignal<Product | null>(() => {
  this.category();
  return null;
});
```

**Heuristique** : avant d'ecrire un `effect()` qui fait `signal.set(...)`, demander "est-ce que la nouvelle valeur se **calcule** a partir d'autres signals ?". Si oui, c'est `linkedSignal()` (ou `computed()` si pas besoin d'ecriture utilisateur).

### Ne pas creer de boucles circulaires

```typescript
// MAUVAIS — boucle infinie
const a = signal(0);
const b = signal(0);
effect(() => { a.set(b() + 1); });
effect(() => { b.set(a() + 1); });
```

### Ne pas lire des signals apres un await

```typescript
// MAUVAIS — les signals lus apres await ne sont pas trackes
effect(async () => {
  const id = userId();
  const response = await fetch(`/api/users/${id}`);
  const name = userName(); // PAS tracke !
});

// BON — lire tous les signals avant le await
effect(async () => {
  const id = userId();
  const name = userName(); // Tracke
  const response = await fetch(`/api/users/${id}?name=${name}`);
});
```

### Ne pas imbriquer les signals dans effect()

```typescript
// MAUVAIS — creer un signal dans un effect
effect(() => {
  const derived = signal(count() * 2); // Fuite memoire
});
```

## Verification de contexte reactif

### assertNotInReactiveContext()

Empeche l'appel d'une fonction depuis un contexte reactif (`computed`, `effect`). Utile pour les operations avec side effects qui ne doivent pas etre trackees.

```typescript
import { assertNotInReactiveContext } from '@angular/core/primitives/signals';

function saveToLocalStorage(key: string, value: string): void {
  assertNotInReactiveContext(saveToLocalStorage);
  localStorage.setItem(key, value);
}

// OK — appel normal
saveToLocalStorage('theme', 'dark');

// ERREUR a l'execution — appel dans un computed/effect
const bad = computed(() => {
  saveToLocalStorage('count', count().toString()); // throws!
  return count();
});
```

## Verification de type de signal

### isSignal() et isWritableSignal()

```typescript
import { isSignal, isWritableSignal, signal, computed } from '@angular/core';

const count = signal(0);
const double = computed(() => count() * 2);
const plainValue = 42;

// isSignal — verifie si la valeur est un Signal (readable ou writable)
isSignal(count);       // true
isSignal(double);      // true
isSignal(plainValue);  // false

// isWritableSignal — verifie si c'est un WritableSignal (signal(), pas computed())
isWritableSignal(count);       // true
isWritableSignal(double);      // false — computed est read-only
isWritableSignal(plainValue);  // false
```

```typescript
// Cas d'usage : fonction utilitaire generique
function resetIfWritable(sig: unknown): void {
  if (isWritableSignal(sig)) {
    sig.set(0); // TypeScript sait que c'est WritableSignal
  }
}
```
