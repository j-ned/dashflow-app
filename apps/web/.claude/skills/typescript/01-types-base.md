# Types de base TypeScript — Reference

## Primitives
```typescript
const name: string = 'John';
const age: number = 30;
const isActive: boolean = true;
const big: bigint = 100n;
const sym: symbol = Symbol('id');
```

## Inference (laisser TS deviner)
```typescript
const name = 'John';    // type: string (infere)
const age = 30;          // type: number (infere)
// Preferer l'inference quand c'est evident — ne pas annoter inutilement
```

## Arrays
```typescript
const names: string[] = ['Alice', 'Bob'];
const ages: number[] = [25, 30];
const matrix: number[][] = [[1, 2], [3, 4]];
// Alternative : Array<string>, Array<number>
```

## Tuples
```typescript
const pair: [string, number] = ['Alice', 25];
const triple: [number, number, number] = [1, 2, 3];
// Tuple readonly
const point: readonly [number, number] = [10, 20];
// Labeled tuple
type Range = [start: number, end: number];
```

## any, unknown, never, void
```typescript
// any — desactive le type checking (eviter)
let data: any = 'hello';

// unknown — type-safe alternative a any (preferer)
let input: unknown = 'hello';
if (typeof input === 'string') {
  console.log(input.toUpperCase()); // OK apres narrowing
}

// void — fonction qui ne retourne rien
function log(msg: string): void { console.log(msg); }

// never — fonction qui ne retourne jamais (throw, boucle infinie)
function fail(msg: string): never { throw new Error(msg); }
```

## null et undefined
```typescript
// En strict mode, null et undefined sont des types distincts
let value: string | null = null;
let optional: string | undefined = undefined;

// Optional chaining
const city = user?.address?.city;

// Nullish coalescing
const name = user?.name ?? 'Anonymous';

// Non-null assertion (a eviter si possible)
const el = document.getElementById('app')!;
```

## Literal types
```typescript
type Direction = 'north' | 'south' | 'east' | 'west';
type HttpStatus = 200 | 301 | 404 | 500;
type YesNo = true | false;

// as const — rend tout readonly et literal
const config = { endpoint: '/api', retries: 3 } as const;
// type: { readonly endpoint: "/api"; readonly retries: 3 }

const colors = ['red', 'green', 'blue'] as const;
// type: readonly ["red", "green", "blue"]
```

## Enums (preferer les union types)
```typescript
// Enum (usage: quand la valeur runtime est necessaire)
enum Role { Admin = 'ADMIN', User = 'USER', Moderator = 'MODERATOR' }

// Union type (prefere — plus leger, pas de code genere)
type Role = 'admin' | 'user' | 'moderator';
```

## Type assertions
```typescript
const el = document.getElementById('app') as HTMLInputElement;
// Double assertion (dernier recours)
const value = expr as unknown as TargetType;
```
