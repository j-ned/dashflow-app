# Mapped Types et Types avances TypeScript — Reference

## Mapped types
```typescript
// Transformer toutes les proprietes
type Optional<T> = { [K in keyof T]?: T[K] };
type ReadonlyAll<T> = { readonly [K in keyof T]: T[K] };
type Nullable<T> = { [K in keyof T]: T[K] | null };

// Supprimer un modificateur
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type Required<T> = { [K in keyof T]-?: T[K] };
```

## Key remapping (as)
```typescript
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

// Filtrer les cles
type OnlyStrings<T> = {
  [K in keyof T as T[K] extends string ? K : never]: T[K];
};
```

## keyof
```typescript
type UserKeys = keyof User;  // 'id' | 'name' | 'email'

function getValue<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

## typeof (type-level)
```typescript
const config = { endpoint: '/api', timeout: 3000 };
type Config = typeof config;  // { endpoint: string; timeout: number }

const fetchUser = async (id: number): Promise<User> => { ... };
type FetchReturn = ReturnType<typeof fetchUser>;  // Promise<User>
```

## Indexed access types
```typescript
type UserName = User['name'];              // string
type UserIdOrName = User['id' | 'name'];   // number | string
type ArrayItem = string[][number];          // string
```

## Conditional types
```typescript
type IsArray<T> = T extends any[] ? true : false;
type IsString<T> = T extends string ? 'string' : 'other';

// Distributive (applique a chaque membre d'un union)
type ToArray<T> = T extends any ? T[] : never;
type Result = ToArray<string | number>;  // string[] | number[]

// Non-distributive (wrappe dans un tuple)
type ToArrayND<T> = [T] extends [any] ? T[] : never;
type Result = ToArrayND<string | number>;  // (string | number)[]
```

## infer
```typescript
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
type UnwrapArray<T> = T extends (infer U)[] ? U : T;
type FirstArg<T> = T extends (first: infer F, ...rest: any[]) => any ? F : never;

// infer avec contrainte (TS 4.7+)
type GetString<T> = T extends { value: infer V extends string } ? V : never;
```

## Satisfies (TS 4.9+)
```typescript
type Colors = Record<string, string | string[]>;

const palette = {
  red: '#ff0000',
  green: ['#00ff00', '#008000'],
} satisfies Colors;

// palette.red est type string (pas string | string[])
// palette.green est type string[]
// Validation du type SANS perdre l'inference
```

## const type parameters (TS 5.0+)
```typescript
function routes<const T extends readonly string[]>(paths: T): T {
  return paths;
}
const r = routes(['/home', '/about']);
// type: readonly ["/home", "/about"] (pas string[])
```
