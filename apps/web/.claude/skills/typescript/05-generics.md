# Generics TypeScript — Reference

## Fonctions generiques
```typescript
function identity<T>(arg: T): T { return arg; }
function first<T>(arr: T[]): T | undefined { return arr[0]; }
function map<T, U>(arr: T[], fn: (item: T) => U): U[] { return arr.map(fn); }

// Inference automatique
const n = identity(42);         // type: number
const s = identity('hello');    // type: string
```

## Contraintes (extends)
```typescript
function getLength<T extends { length: number }>(arg: T): number {
  return arg.length;
}
getLength('hello');    // OK
getLength([1, 2, 3]); // OK
getLength(42);         // Erreur: number n'a pas 'length'

// Contrainte avec keyof
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

## Interfaces et types generiques
```typescript
interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
};

type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
```

## Classes generiques
```typescript
class Repository<T extends { id: number }> {
  private items: T[] = [];

  add(item: T): void { this.items.push(item); }
  findById(id: number): T | undefined { return this.items.find(i => i.id === id); }
  findAll(): T[] { return [...this.items]; }
}

const userRepo = new Repository<User>();
```

## Default type parameters
```typescript
type Container<T = string> = { value: T };
const c: Container = { value: 'hello' }; // T = string par defaut
const n: Container<number> = { value: 42 };

interface Options<T = Record<string, unknown>> {
  data: T;
  timeout?: number;
}
```

## Generics conditionnels
```typescript
type IsString<T> = T extends string ? 'yes' : 'no';
type A = IsString<string>;  // 'yes'
type B = IsString<number>;  // 'no'

// Extract / Exclude
type Numbers = Extract<string | number | boolean, number>; // number
type NoStrings = Exclude<string | number | boolean, string>; // number | boolean
```

## infer (extraire un type dans une condition)
```typescript
type ReturnOf<T> = T extends (...args: any[]) => infer R ? R : never;
type ArrayItem<T> = T extends (infer U)[] ? U : never;
type PromiseValue<T> = T extends Promise<infer U> ? U : T;

type R = ReturnOf<() => string>;     // string
type I = ArrayItem<number[]>;        // number
type P = PromiseValue<Promise<User>>; // User
```
