# API de Test Vitest — Reference

## Structure de base
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('Calculator', () => {
  let calc: Calculator;

  beforeEach(() => {
    calc = new Calculator();
  });

  it('should add two numbers', () => {
    expect(calc.add(1, 2)).toBe(3);
  });

  it('should subtract two numbers', () => {
    expect(calc.subtract(5, 3)).toBe(2);
  });
});
```

## Hooks
```typescript
beforeAll(() => { /* une fois avant tous les tests */ });
afterAll(() => { /* une fois apres tous les tests */ });
beforeEach(() => { /* avant chaque test */ });
afterEach(() => { /* apres chaque test */ });
```

## Modificateurs de test
```typescript
it.skip('skipped test', () => { });        // ignorer
it.only('only this runs', () => { });      // seul ce test
it.todo('implement later');                 // a faire
it.fails('expected to fail', () => { });   // echec attendu
it.concurrent('parallel test', async () => { }); // parallele

// Conditionnel
it.skipIf(process.env.CI)('skip in CI', () => { });
it.runIf(process.env.CI)('only in CI', () => { });
```

## Tests parametres (it.each)
```typescript
it.each([
  { a: 1, b: 2, expected: 3 },
  { a: 5, b: 3, expected: 8 },
  { a: -1, b: 1, expected: 0 },
])('add($a, $b) = $expected', ({ a, b, expected }) => {
  expect(add(a, b)).toBe(expected);
});

// Avec tableau
it.each([
  [1, 2, 3],
  [5, 3, 8],
])('add(%i, %i) = %i', (a, b, expected) => {
  expect(add(a, b)).toBe(expected);
});
```

## Tests async
```typescript
it('should fetch user', async () => {
  const user = await fetchUser(1);
  expect(user.name).toBe('John');
});
```

## Describe imbrique
```typescript
describe('UserService', () => {
  describe('create', () => {
    it('should create a user', () => { });
    it('should throw on duplicate email', () => { });
  });
  describe('delete', () => {
    it('should delete a user', () => { });
  });
});
```
