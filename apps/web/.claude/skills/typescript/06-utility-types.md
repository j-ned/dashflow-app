# Utility Types TypeScript — Reference

## Transformation de proprietes
```typescript
// Partial<T> — toutes les proprietes optionnelles
type UpdateUser = Partial<User>;
// { id?: number; name?: string; email?: string; }

// Required<T> — toutes les proprietes requises
type FullUser = Required<User>;

// Readonly<T> — toutes les proprietes read-only
type FrozenUser = Readonly<User>;
```

## Selection / Exclusion de proprietes
```typescript
// Pick<T, K> — garder certaines proprietes
type UserPreview = Pick<User, 'id' | 'name'>;
// { id: number; name: string; }

// Omit<T, K> — exclure certaines proprietes
type CreateUser = Omit<User, 'id' | 'createdAt'>;
// { name: string; email: string; }
```

## Record
```typescript
// Record<K, V> — objet avec cles K et valeurs V
type StatusMap = Record<'active' | 'inactive' | 'banned', number>;
// { active: number; inactive: number; banned: number; }

type Cache = Record<string, User>;
```

## Extraction / Exclusion de types
```typescript
// Extract<T, U> — garder les types assignables a U
type Nums = Extract<string | number | boolean, number | string>;
// string | number

// Exclude<T, U> — exclure les types assignables a U
type NoStr = Exclude<string | number | boolean, string>;
// number | boolean

// NonNullable<T> — exclure null et undefined
type Defined = NonNullable<string | null | undefined>;
// string
```

## Types de fonctions
```typescript
// ReturnType<T> — type de retour d'une fonction
type R = ReturnType<typeof fetchUser>;  // Promise<User>

// Parameters<T> — types des parametres (tuple)
type P = Parameters<typeof fetchUser>;  // [id: number]

// ConstructorParameters<T> — parametres du constructeur
type CP = ConstructorParameters<typeof Date>;

// InstanceType<T> — type de l'instance
type D = InstanceType<typeof Date>;  // Date
```

## Awaited
```typescript
// Awaited<T> — unwrap les Promise (recursif)
type A = Awaited<Promise<string>>;          // string
type B = Awaited<Promise<Promise<number>>>; // number
```

## Template literal types
```typescript
type EventName = `on${Capitalize<string>}`;
type CssProperty = `${string}-${string}`;

type Getters<T> = { [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K] };
// { getName: () => string; getAge: () => number; }

// Built-in string manipulation
type Upper = Uppercase<'hello'>;       // 'HELLO'
type Lower = Lowercase<'HELLO'>;       // 'hello'
type Cap = Capitalize<'hello'>;        // 'Hello'
type Uncap = Uncapitalize<'Hello'>;    // 'hello'
```
