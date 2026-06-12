# Expect Vitest — Reference (Matchers)

## Egalite
```typescript
expect(2 + 2).toBe(4);                    // egalite stricte (Object.is)
expect({ a: 1 }).toEqual({ a: 1 });       // egalite profonde
expect(obj).toStrictEqual(expected);       // egalite stricte (verifie les types)
```

## Veracite
```typescript
expect(value).toBeTruthy();               // truthy
expect(value).toBeFalsy();                // falsy
expect(value).toBeNull();                 // === null
expect(value).toBeUndefined();            // === undefined
expect(value).toBeDefined();              // !== undefined
expect(value).toBeNaN();                  // NaN
```

## Nombres
```typescript
expect(value).toBeGreaterThan(3);
expect(value).toBeGreaterThanOrEqual(3);
expect(value).toBeLessThan(10);
expect(value).toBeLessThanOrEqual(10);
expect(0.1 + 0.2).toBeCloseTo(0.3, 5);   // flottants
```

## Texte
```typescript
expect('hello world').toContain('world');
expect('hello').toMatch(/ell/);
expect('hello').toMatch('ell');
expect(str).toHaveLength(5);
```

## Collections
```typescript
expect([1, 2, 3]).toContain(2);
expect([{ id: 1 }]).toContainEqual({ id: 1 });  // deep equality
expect(arr).toHaveLength(3);
```

## Objets
```typescript
expect(obj).toHaveProperty('name');
expect(obj).toHaveProperty('name', 'John');
expect(obj).toHaveProperty('address.city');         // chemin imbrique
expect(obj).toHaveProperty(['items', 0, 'name']);   // chemin tableau
expect(obj).toMatchObject({ name: 'John' });        // correspondance partielle
```

## Erreurs
```typescript
expect(() => throwingFn()).toThrow();
expect(() => throwingFn()).toThrow('message');
expect(() => throwingFn()).toThrow(/regex/);
expect(() => throwingFn()).toThrow(CustomError);
```

## Promesses
```typescript
await expect(asyncFn()).resolves.toBe(42);
await expect(asyncFn()).resolves.toEqual({ id: 1 });
await expect(failingFn()).rejects.toThrow('error');
```

## Negation
```typescript
expect(value).not.toBe(3);
expect(arr).not.toContain(5);
```

## Matchers asymetriques
```typescript
expect(obj).toEqual({
  id: expect.any(Number),
  name: expect.any(String),
  email: expect.stringContaining('@'),
  tags: expect.arrayContaining(['admin']),
  address: expect.objectContaining({ city: 'Paris' }),
  code: expect.stringMatching(/^[A-Z]{3}$/),
});

expect(value).toEqual(expect.anything()); // tout sauf null/undefined
```

## Soft assertions (continue apres echec)
```typescript
expect.soft(1 + 1).toBe(3);  // echoue mais continue
expect.soft(2 + 2).toBe(5);  // echoue aussi
// le test rapporte toutes les erreurs
```

## Nombre d'assertions
```typescript
expect.assertions(2);       // exactement 2 assertions attendues
expect.hasAssertions();      // au moins une assertion
```

## Snapshots
```typescript
expect(data).toMatchSnapshot();
expect(data).toMatchInlineSnapshot(`{ "id": 1 }`);
```

## Custom matcher
```typescript
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    return {
      pass,
      message: () => `expected ${received} to be within [${floor}, ${ceiling}]`,
    };
  },
});
expect(100).toBeWithinRange(90, 110);
```
