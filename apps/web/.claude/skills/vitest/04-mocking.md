# Mocking Vitest — Reference (vi)

## vi.fn — mock de fonction
```typescript
import { vi } from 'vitest';

const fn = vi.fn();                       // mock vide
const fn = vi.fn(() => 42);               // avec implementation
fn.mockReturnValue(42);                    // retourner une valeur
fn.mockReturnValueOnce(42);               // retourner une fois
fn.mockResolvedValue({ id: 1 });           // retourner une Promise resolue
fn.mockResolvedValueOnce({ id: 1 });       // une fois
fn.mockRejectedValue(new Error('fail'));   // Promise rejetee
fn.mockImplementation(() => 'hello');       // changer l'implementation
fn.mockImplementationOnce(() => 'once');    // une fois

// Assertions
expect(fn).toHaveBeenCalled();
expect(fn).toHaveBeenCalledTimes(2);
expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
expect(fn).toHaveBeenLastCalledWith('last');
expect(fn).toHaveBeenNthCalledWith(1, 'first');
expect(fn).toHaveReturnedWith(42);
```

## vi.spyOn — espionner une methode
```typescript
const spy = vi.spyOn(userService, 'findAll');
spy.mockResolvedValue([{ id: 1, name: 'John' }]);

await userService.findAll();
expect(spy).toHaveBeenCalled();

// Espionner un getter
const spy = vi.spyOn(obj, 'value', 'get').mockReturnValue(42);
// Espionner un setter
const spy = vi.spyOn(obj, 'value', 'set');
```

## vi.mock — mock de module
```typescript
// Mock automatique (toutes les exports deviennent des vi.fn())
vi.mock('./userService');

// Mock avec factory
vi.mock('./userService', () => ({
  UserService: vi.fn().mockImplementation(() => ({
    findAll: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
  })),
}));

// Mock partiel (garder le reste de l'implementation)
vi.mock('./utils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    formatDate: vi.fn().mockReturnValue('2024-01-01'),
  };
});

// Mock avec spy: true (garde l'implementation, ajoute les espions)
vi.mock('./calculator', { spy: true });
```

## vi.mocked — helper TypeScript
```typescript
import { myFunction } from './module';
vi.mock('./module');
vi.mocked(myFunction).mockReturnValue(42);
```

## Cleanup
```typescript
afterEach(() => {
  vi.clearAllMocks();     // clear l'historique des appels
  vi.resetAllMocks();     // reset + supprime les implementations
  vi.restoreAllMocks();   // restaure les implementations originales
});

// Ou dans la config :
// test: { clearMocks: true, restoreMocks: true }
```

## vi.stubGlobal — mock de globales
```typescript
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ data: 'test' }),
}));

// Restaurer
afterEach(() => vi.unstubAllGlobals());
```

## vi.stubEnv — mock d'env
```typescript
vi.stubEnv('NODE_ENV', 'production');
vi.stubEnv('API_URL', 'https://api.test.com');

afterEach(() => vi.unstubAllEnvs());
```
