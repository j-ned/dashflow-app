# Patterns de Test Vitest — Reference

## Pattern AAA (Arrange, Act, Assert)
```typescript
it('should add item to cart', () => {
  // Arrange
  const cart = new Cart();
  const item = { id: 1, name: 'Book', price: 15 };

  // Act
  cart.addItem(item);

  // Assert
  expect(cart.items).toHaveLength(1);
  expect(cart.items[0]).toEqual(item);
  expect(cart.total).toBe(15);
});
```

## Pattern Given/When/Then (EAK)
```typescript
describe('GetBooksUseCase', () => {
  it('should return books from the gateway', () => {
    // Given
    const books = [{ id: 1, title: 'Clean Code' }];
    const gateway: GetBooksGateway = {
      getBooks: () => defer(() => of(books)),
    };
    const useCase = new GetBooksUseCase(gateway);

    // When
    let result: Book[];
    useCase.execute().subscribe(res => (result = res));

    // Then
    expect(result).toEqual(books);
  });
});
```

## Triangulation (it.each — EAK)
```typescript
it.each([
  { input: [{ id: 1, title: 'A' }], label: 'one book' },
  { input: [{ id: 1, title: 'A' }, { id: 2, title: 'B' }], label: 'two books' },
  { input: [], label: 'empty list' },
])('should return $label', ({ input }) => {
  const gateway = { getBooks: () => defer(() => of(input)) };
  const useCase = new GetBooksUseCase(gateway);
  let result: Book[];
  useCase.execute().subscribe(res => (result = res));
  expect(result).toEqual(input);
});
```

## Builder pattern (donnees de test)
```typescript
class UserBuilder {
  private entity: User = { id: 1, name: 'Default', email: 'default@test.com', role: 'user' };
  private constructor() {}

  static default(): UserBuilder { return new UserBuilder(); }
  with<K extends keyof User>(key: K, value: User[K]): UserBuilder {
    this.entity[key] = value; return this;
  }
  asAdmin(): UserBuilder { this.entity.role = 'admin'; return this; }
  build(): User { return { ...this.entity }; }
}

// Usage
const admin = UserBuilder.default().with('name', 'Admin').asAdmin().build();
```

## Test d'erreurs
```typescript
it('should throw on invalid input', () => {
  expect(() => validate('')).toThrow('Input required');
});

it('should reject with error', async () => {
  await expect(fetchUser(-1)).rejects.toThrow('Invalid ID');
});
```

## Test de code async
```typescript
it('should resolve with data', async () => {
  const result = await fetchData();
  expect(result).toEqual({ id: 1 });
});

// Avec vi.waitFor (polling)
it('should eventually be ready', async () => {
  await vi.waitFor(() => {
    expect(server.isReady).toBe(true);
  }, { timeout: 5000, interval: 100 });
});
```

## Selecteurs de test DOM (convention EAK)
Attribut datatest-id pour les selecteurs :
```html
<button datatest-id="submit-btn">Submit</button>
```
```typescript
const btn = fixture.nativeElement.querySelector('[datatest-id="submit-btn"]');
```

## Cleanup automatique
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    clearMocks: true,       // clear apres chaque test
    restoreMocks: true,     // restaurer apres chaque test
  },
});
```
