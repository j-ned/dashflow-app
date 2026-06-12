# Fonctions TypeScript — Reference

## Annotations de base
```typescript
function greet(name: string): string {
  return `Hello, ${name}`;
}

// Arrow function
const greet = (name: string): string => `Hello, ${name}`;

// Retour void
const log = (msg: string): void => console.log(msg);

// Retour Promise
async function fetchUser(id: number): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}
```

## Parametres optionnels et defaults
```typescript
function greet(name: string, greeting?: string): string {
  return `${greeting ?? 'Hello'}, ${name}`;
}

function greet(name: string, greeting = 'Hello'): string {
  return `${greeting}, ${name}`;
}
```

## Rest parameters
```typescript
function sum(...nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}
```

## Overloads
```typescript
function parse(input: string): number;
function parse(input: number): string;
function parse(input: string | number): string | number {
  if (typeof input === 'string') return parseInt(input, 10);
  return input.toString();
}
```

## Type de fonction
```typescript
type Callback = (data: string) => void;
type Predicate<T> = (item: T) => boolean;
type AsyncFn<T> = () => Promise<T>;

// Avec interface
interface EventHandler {
  (event: Event): void;
}
```

## Generics dans les fonctions
```typescript
function identity<T>(arg: T): T { return arg; }
const result = identity('hello'); // type: string (infere)

function first<T>(arr: T[]): T | undefined { return arr[0]; }

// Contrainte
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// Multiple generics
function merge<T, U>(a: T, b: U): T & U {
  return { ...a, ...b };
}
```

## Arrow generics (JSX-safe)
```typescript
const identity = <T,>(arg: T): T => arg;  // virgule apres T pour eviter ambiguite JSX
```
