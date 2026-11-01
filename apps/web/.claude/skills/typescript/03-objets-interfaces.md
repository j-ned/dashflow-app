# Objets et Interfaces TypeScript — Reference

## type vs interface
```typescript
// type — pour les unions, intersections, mapped types, tuples
type Status = 'active' | 'inactive';
type Result = Success | Error;
type UserInput = Omit<User, 'id'>;

// interface — pour les contrats d'objet, extends, implements
interface User {
  id: number;
  name: string;
  email: string;
}

// Convention EAK : type pour les modeles de donnees, interface pour les contrats (gateways)
```

## Proprietes
```typescript
interface User {
  readonly id: number;           // read-only
  name: string;                  // requis
  bio?: string;                  // optionnel
  [key: string]: unknown;        // index signature (props dynamiques)
}
```

## Extending
```typescript
// Interface extends
interface Admin extends User {
  permissions: string[];
}

// Type intersection
type Admin = User & { permissions: string[] };

// Multiple extends
interface SuperAdmin extends Admin, Auditable {
  level: number;
}
```

## Implements (classes)
```typescript
interface Repository<T> {
  findAll(): Promise<T[]>;
  findById(id: number): Promise<T | null>;
  create(data: Omit<T, 'id'>): Promise<T>;
  delete(id: number): Promise<void>;
}

class UserRepository implements Repository<User> {
  async findAll() { /* ... */ }
  async findById(id: number) { /* ... */ }
  async create(data: Omit<User, 'id'>) { /* ... */ }
  async delete(id: number) { /* ... */ }
}
```

## Objets avec types inline
```typescript
function createUser(config: { name: string; email: string; age?: number }): User {
  // ...
}
```

## Record
```typescript
const cache: Record<string, User> = {};
const statusMap: Record<HttpStatus, string> = {
  200: 'OK',
  404: 'Not Found',
  500: 'Server Error',
};
```
