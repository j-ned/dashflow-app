# Unions et Narrowing TypeScript — Reference

## Union types
```typescript
type StringOrNumber = string | number;
type Result = Success | Error;
type Nullable<T> = T | null;
type Optional<T> = T | undefined;
```

## Narrowing (affiner les types)

### typeof guard
```typescript
function format(value: string | number): string {
  if (typeof value === 'string') {
    return value.toUpperCase();  // type: string
  }
  return value.toFixed(2);      // type: number
}
```

### Truthiness
```typescript
function greet(name: string | null): string {
  if (name) {
    return `Hello, ${name}`;    // type: string
  }
  return 'Hello, stranger';
}
```

### Equality
```typescript
function compare(a: string | number, b: string | boolean) {
  if (a === b) {
    // type: string (seul type commun)
  }
}
```

### in operator
```typescript
type Fish = { swim: () => void };
type Bird = { fly: () => void };

function move(animal: Fish | Bird) {
  if ('swim' in animal) {
    animal.swim();  // type: Fish
  } else {
    animal.fly();   // type: Bird
  }
}
```

### instanceof
```typescript
function logDate(value: Date | string) {
  if (value instanceof Date) {
    console.log(value.toISOString());  // type: Date
  } else {
    console.log(new Date(value).toISOString());  // type: string
  }
}
```

## Discriminated unions (pattern recommande)
```typescript
type Success = { status: 'success'; data: User };
type Error = { status: 'error'; message: string };
type Loading = { status: 'loading' };
type Result = Success | Error | Loading;

function handle(result: Result) {
  switch (result.status) {
    case 'success':
      console.log(result.data);     // type: Success
      break;
    case 'error':
      console.log(result.message);  // type: Error
      break;
    case 'loading':
      console.log('Loading...');    // type: Loading
      break;
  }
}
```

## Type predicates (custom type guards)
```typescript
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value
  );
}

// Usage
if (isUser(data)) {
  console.log(data.name); // type: User
}
```

## Assertion functions
```typescript
function assertDefined<T>(value: T | null | undefined, msg?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(msg ?? 'Value is null or undefined');
  }
}

const user = getUser();
assertDefined(user);
console.log(user.name); // type: User (plus null)
```

## Exhaustiveness checking (never)
```typescript
type Shape = Circle | Square | Triangle;

function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle': return Math.PI * shape.radius ** 2;
    case 'square': return shape.size ** 2;
    case 'triangle': return (shape.base * shape.height) / 2;
    default:
      const _exhaustive: never = shape; // erreur si un cas manque
      return _exhaustive;
  }
}
```
