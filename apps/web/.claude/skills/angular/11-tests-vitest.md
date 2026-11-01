# Tests Angular avec Vitest — Reference (EAK)

## Setup

```bash
ng test --watch
```

- Fichier de test : `.spec.ts` a cote du fichier teste
- Structure : `describe` > `it` (Given/When/Then — AAA : Arrange, Act, Assert)
- Vitest est le runner par defaut depuis Angular recent
- Pas besoin de `zone.js` pour les tests avec signals

## Providers globaux de test

```typescript
// src/test-providers.ts
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

export default [provideHttpClient(), provideHttpClientTesting()];
```

Reference dans `angular.json` via `providersFile` pour eviter de les declarer dans chaque test.

## Types de tests

| Type | Scope | Dependencies | TestBed |
|------|-------|-------------|---------|
| **Unitaire** | TypeScript seul | Tout mocke | Non |
| **Composant** | TypeScript + HTML | Tout mocke | Oui |
| **Integration** | TypeScript + HTML, traverse les couches | Non mocke | Oui |

### Choix du type

- **Domain** (use cases, adapters) → test unitaire, pas de TestBed
- **Composants dumb** → test de composant, inputs/outputs manuels
- **Composants smart** → test d'integration, verifier le comportement de bout en bout
- **Services** → test unitaire ou integration selon la complexite

## Test doubles

| Type | Description | Quand |
|------|-------------|-------|
| **Stub** | Donnees fixes | Retourner une valeur connue |
| **Fake** | Implementation simplifiee | In-memory gateway |
| **Mock** | Spy avec assertions | Verifier les appels |

```typescript
// Stub
const stub = { getBooks: vi.fn().mockReturnValue(of([{ id: 1, title: 'Clean Code' }])) };

// Fake
const fake = new InMemoryBookGateway(); // Implementation complete in-memory

// Mock
const mock = vi.fn();
mock('arg');
expect(mock).toHaveBeenCalledWith('arg');
```

## Test du domain (sans TestBed)

```typescript
describe('GetBooksUseCase', () => {
  it.each([
    { books: [{ id: 1, title: 'Clean Code', author: 'R. Martin' }] },
    { books: [{ id: 42, title: 'Design Patterns', author: 'GoF' }] },
    { books: [] },
  ])('should return books: %j', ({ books }) => {
    // Arrange
    const gateway: GetBooksGateway = {
      getBooks: () => defer(() => of(books)),
    };
    const useCase = new GetBooksUseCase(gateway);

    // Act
    let result: Book[];
    useCase.execute().subscribe(res => (result = res));

    // Assert
    expect(result!).toEqual(books);
  });
});
```

### Conventions

- `it.each` pour la **triangulation TDD** (plusieurs jeux de donnees)
- `toEqual` pour objets/arrays (comparaison profonde)
- `toBe` pour primitives (comparaison par reference)
- `defer(() => of(data))` pour simuler le timing async des vrais services

### Test d'un adapter

```typescript
describe('toPeople', () => {
  it('should transform SwapiPeople to People', () => {
    const raw: SwapiPeople = {
      name: 'Luke',
      height: '172',
      gender: 'male',
      skills: 'Force, Lightsaber',
    };

    const result = toPeople(raw);

    expect(result).toEqual({
      name: 'Luke',
      height: 172,
      gender: 'male',
      skills: ['Force', 'Lightsaber'],
    });
  });

  it('should handle invalid height', () => {
    const raw: SwapiPeople = { name: 'Unknown', height: 'n/a', gender: 'none', skills: '' };
    expect(toPeople(raw).height).toBe(0);
  });
});
```

## Test de composant

### Setup avec overrideComponent

```typescript
describe('UserCard', () => {
  let fixture: ComponentFixture<UserCard>;

  beforeEach(() => {
    fixture = TestBed.overrideComponent(UserCard, {
      set: {
        providers: [],
        imports: [],
        schemas: [NO_ERRORS_SCHEMA],  // ignorer les composants enfants inconnus
      },
    }).createComponent(UserCard);
  });

  it('should display user name', () => {
    // Arrange — setter les inputs
    fixture.componentRef.setInput('name', 'Alice');
    fixture.componentRef.setInput('createdAt', new Date('2025-01-01'));

    // Act
    fixture.detectChanges();

    // Assert
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Alice');
  });
});
```

- `overrideComponent` prefere a `configureTestingModule` — plus explicite et isole
- **Signals = synchrones** — pas besoin de `fakeAsync`, `tick`, ou `whenStable`
- `fixture.componentRef.setInput('name', 'value')` pour setter un input signal

### Test d'un output

```typescript
it('should emit userSelected on click', () => {
  fixture.componentRef.setInput('user', { id: 1, name: 'Alice' });
  fixture.detectChanges();

  let emittedUser: User | undefined;
  fixture.componentInstance.userSelected.subscribe(u => (emittedUser = u));

  const button = fixture.nativeElement.querySelector('[datatest-id="select-btn"]');
  button.click();

  expect(emittedUser).toEqual({ id: 1, name: 'Alice' });
});
```

## Test HTTP

```typescript
describe('HttpPeopleGateway', () => {
  let gateway: HttpPeopleGateway;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        HttpPeopleGateway,
      ],
    });

    gateway = TestBed.inject(HttpPeopleGateway);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify(); // aucune requete en attente
  });

  it('should fetch and adapt people', () => {
    const mockRaw: SwapiPeople[] = [
      { name: 'Luke', height: '172', gender: 'male', skills: 'Force' },
    ];

    let result: People[];
    gateway.getPeople().subscribe(res => (result = res));

    const req = httpController.expectOne('/api/people');
    expect(req.request.method).toBe('GET');
    req.flush(mockRaw);

    expect(result!).toEqual([
      { name: 'Luke', height: 172, gender: 'male', skills: ['Force'] },
    ]);
  });
});
```

## Test d'integration (composant + vraie couche)

```typescript
describe('PeopleListPage — integration', () => {
  let fixture: ComponentFixture<PeopleListPage>;
  let httpController: HttpTestingController;

  beforeEach(() => {
    TestBed.overrideComponent(PeopleListPage, {
      set: {
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: GetPeopleGateway, useClass: HttpPeopleGateway },
          GetPeopleUseCase,
        ],
      },
    });

    fixture = TestBed.createComponent(PeopleListPage);
    httpController = TestBed.inject(HttpTestingController);
  });

  it('should display people from API', () => {
    fixture.detectChanges();

    httpController.expectOne('/api/people').flush([
      { name: 'Luke', height: '172', gender: 'male', skills: 'Force' },
    ]);

    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('[datatest-id="people-item"]');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain('Luke');
  });
});
```

## Selecteurs de test

### Convention datatest-id

```html
<!-- Dans le template -->
<div datatest-id="people-item">{{ person.name }}</div>
<button datatest-id="submit-btn">Envoyer</button>
```

```typescript
// Dans le test
const items = fixture.nativeElement.querySelectorAll('[datatest-id="people-item"]');
const button = fixture.nativeElement.querySelector('[datatest-id="submit-btn"]');
```

### A eviter

- `id` — couplage avec la logique applicative
- `class` — couplage avec le style
- Contenu texte — fragile, change avec les traductions

## PageModel

Pattern pour encapsuler les interactions avec le DOM dans un objet dedie :

```typescript
class BookEditPageModel {
  constructor(private readonly fixture: ComponentFixture<BookEdit>) {}

  // Selecteurs
  get titleInput(): DebugElement {
    return this.fixture.debugElement.query(By.css('[datatest-id="title-input"]'));
  }

  get submitButton(): DebugElement {
    return this.fixture.debugElement.query(By.css('[datatest-id="submit-btn"]'));
  }

  get errorMessage(): string | null {
    const el = this.fixture.debugElement.query(By.css('[datatest-id="error-msg"]'));
    return el?.nativeElement.textContent ?? null;
  }

  // Actions
  typeTitle(value: string): void {
    this.titleInput.nativeElement.value = value;
    this.titleInput.triggerEventHandler('input', {
      target: this.titleInput.nativeElement,
    });
    this.fixture.detectChanges();
  }

  submit(): void {
    this.submitButton.nativeElement.click();
    this.fixture.detectChanges();
  }
}
```

```typescript
// Utilisation dans le test
it('should show error for empty title', () => {
  const page = new BookEditPageModel(fixture);
  page.typeTitle('');
  page.submit();
  expect(page.errorMessage).toContain('requis');
});
```

## Builder

Pattern pour construire des objets de test avec des valeurs par defaut :

```typescript
class BookBuilder {
  private entity: Book = {
    id: 1,
    title: 'Default Title',
    author: 'Default Author',
    year: 2024,
  };

  static default(): BookBuilder {
    return new BookBuilder();
  }

  with<K extends keyof Book>(key: K, value: Book[K]): BookBuilder {
    this.entity[key] = value;
    return this;
  }

  build(): Book {
    return { ...this.entity };
  }
}
```

```typescript
// Utilisation
const book = BookBuilder.default().with('title', 'Clean Code').with('year', 2008).build();
const books = [
  BookBuilder.default().with('id', 1).build(),
  BookBuilder.default().with('id', 2).with('title', 'DDD').build(),
];
```

## Date mocking

```typescript
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
});

afterAll(() => {
  vi.useRealTimers();
});

it('should format date correctly', () => {
  expect(formatToday()).toBe('2025-01-01');
});
```

## vi.fn() et vi.spyOn()

```typescript
// Mock d'une fonction
const mockFn = vi.fn().mockReturnValue(42);
expect(mockFn()).toBe(42);
expect(mockFn).toHaveBeenCalledTimes(1);

// Mock avec implementation
const mockFn = vi.fn((x: number) => x * 2);

// Spy sur une methode existante
const spy = vi.spyOn(service, 'getUsers').mockReturnValue(of([]));
// ...
expect(spy).toHaveBeenCalledWith('admin');
spy.mockRestore(); // restaurer l'implementation originale
```

## Assertions communes

```typescript
expect(value).toBe(42);                    // egalite stricte (===)
expect(obj).toEqual({ id: 1 });            // egalite profonde
expect(arr).toHaveLength(3);               // longueur
expect(str).toContain('hello');            // inclusion
expect(fn).toThrow();                      // lance une erreur
expect(fn).toThrowError('message');        // lance avec message
expect(value).toBeDefined();               // !== undefined
expect(value).toBeNull();                  // === null
expect(value).toBeTruthy();                // truthy
expect(spy).toHaveBeenCalled();            // appele au moins une fois
expect(spy).toHaveBeenCalledWith('arg');   // appele avec ces arguments
expect(spy).toHaveBeenCalledTimes(2);      // nombre d'appels
```

## RouterTestingHarness — tester les composants routes

> **IMPORTANT** : ne JAMAIS mocker `Router`. Utiliser `RouterTestingHarness` a la place.

```typescript
import { RouterTestingHarness } from '@angular/router/testing';
import { provideRouter } from '@angular/router';

describe('UserDetail — routed', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'users/:id', component: UserDetail },
          { path: '', component: Home },
        ]),
        { provide: UserService, useValue: { getUser: vi.fn().mockReturnValue(of({ id: '1', name: 'Alice' })) } },
      ],
    });

    harness = await RouterTestingHarness.create();
  });

  it('should navigate to user detail', async () => {
    // Act — naviguer vers la route
    const fixture = await harness.navigateByUrl('/users/1', UserDetail);

    // Wait — attendre la stabilite
    await fixture.whenStable();

    // Assert
    expect(harness.routeNativeElement?.textContent).toContain('Alice');
    expect(TestBed.inject(Router).url).toBe('/users/1');
  });

  it('should navigate to home', async () => {
    await harness.navigateByUrl('/', Home);
    expect(TestBed.inject(Router).url).toBe('/');
  });
});
```

### Points cles

- `RouterTestingHarness.create()` — cree le harness (async)
- `harness.navigateByUrl(url, ComponentType)` — navigue et retourne le fixture
- `harness.routeNativeElement` — element natif du composant route
- `TestBed.inject(Router).url` — verifier l'URL courante
- Toujours `await fixture.whenStable()` apres la navigation

## Component Harnesses — tester les composants Material

Les Component Harnesses fournissent une API stable pour interagir avec les composants UI (Material, CDK, ou custom).

```typescript
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { HarnessLoader } from '@angular/cdk/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatInputHarness } from '@angular/material/input/testing';

describe('Login — with harnesses', () => {
  let fixture: ComponentFixture<Login>;
  let loader: HarnessLoader;

  beforeEach(() => {
    fixture = TestBed.configureTestingModule({
      imports: [Login],
    }).createComponent(Login);

    // Creer le HarnessLoader a partir du fixture
    loader = TestbedHarnessEnvironment.loader(fixture);
  });

  it('should submit login form', async () => {
    // Obtenir les harnesses des composants Material
    const emailInput = await loader.getHarness(MatInputHarness.with({ selector: '[datatest-id="email"]' }));
    const passwordInput = await loader.getHarness(MatInputHarness.with({ selector: '[datatest-id="password"]' }));
    const submitButton = await loader.getHarness(MatButtonHarness.with({ text: 'Se connecter' }));

    // Interagir via l'API du harness
    await emailInput.setValue('alice@test.com');
    await passwordInput.setValue('password123');
    await submitButton.click();

    // Assert
    expect(fixture.componentInstance.submitted()).toBeTrue();
  });

  it('should disable submit when form is invalid', async () => {
    const submitButton = await loader.getHarness(MatButtonHarness.with({ text: 'Se connecter' }));
    expect(await submitButton.isDisabled()).toBeTrue();
  });
});
```

### API principale

```typescript
// Obtenir un harness
const button = await loader.getHarness(MatButtonHarness);

// Obtenir avec filtre
const button = await loader.getHarness(MatButtonHarness.with({ text: /Submit/ }));

// Obtenir tous les harnesses d'un type
const buttons = await loader.getAllHarnesses(MatButtonHarness);

// Obtenir un loader enfant (scope)
const formLoader = await loader.getChildLoader('[datatest-id="login-form"]');
```

## Pattern de test recommande : Act, Wait, Assert

> **Regle fondamentale (testing-fundamentals)** : ne JAMAIS appeler `fixture.detectChanges()` manuellement. Utiliser `await fixture.whenStable()` a la place.

```typescript
it('should display data after loading', async () => {
  // Arrange
  const fixture = TestBed.createComponent(MyComponent);

  // Act — declencher une action
  fixture.componentRef.setInput('userId', '42');

  // Wait — attendre la stabilite (remplace fixture.detectChanges())
  await fixture.whenStable();

  // Assert
  expect(fixture.nativeElement.textContent).toContain('User 42');
});
```

### Pourquoi eviter fixture.detectChanges()

- `detectChanges()` est un mecanisme bas niveau qui force la detection de changements
- `whenStable()` attend que **toutes** les operations async soient terminees (microtasks, promises, observables)
- Avec les signals et le mode zoneless, `whenStable()` est plus fiable et plus proche du comportement reel
