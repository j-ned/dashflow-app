# Patterns TypeScript — Reference

## Branded types (types nominaux)
```typescript
type UserId = number & { readonly __brand: unique symbol };
type PostId = number & { readonly __brand: unique symbol };

function createUserId(id: number): UserId { return id as UserId; }
function createPostId(id: number): PostId { return id as PostId; }

function getUser(id: UserId): User { /* ... */ }
getUser(createUserId(1)); // OK
getUser(createPostId(1)); // Erreur: PostId n'est pas assignable a UserId
```

## Builder pattern
```typescript
class QueryBuilder<T> {
  private filters: Record<string, unknown> = {};
  private sortField?: keyof T;

  where<K extends keyof T>(field: K, value: T[K]): this {
    this.filters[field as string] = value;
    return this;
  }

  orderBy(field: keyof T): this {
    this.sortField = field;
    return this;
  }

  build(): Query<T> { /* ... */ }
}
```

## Result pattern (pas d'exceptions)
```typescript
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function parseJson<T>(json: string): Result<T> {
  try {
    return { ok: true, value: JSON.parse(json) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

const result = parseJson<User>(data);
if (result.ok) {
  console.log(result.value.name); // type-safe
} else {
  console.error(result.error.message);
}
```

## Type-safe event emitter
```typescript
type EventMap = {
  userCreated: { user: User };
  userDeleted: { userId: number };
  error: { message: string };
};

class TypedEmitter<T extends Record<string, unknown>> {
  private handlers = new Map<keyof T, Set<Function>>();

  on<K extends keyof T>(event: K, handler: (payload: T[K]) => void): void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
  }

  emit<K extends keyof T>(event: K, payload: T[K]): void {
    this.handlers.get(event)?.forEach(h => h(payload));
  }
}

const emitter = new TypedEmitter<EventMap>();
emitter.on('userCreated', ({ user }) => console.log(user.name)); // type-safe
```

## Assertion maps
```typescript
const ROLES = ['admin', 'user', 'moderator'] as const;
type Role = typeof ROLES[number]; // 'admin' | 'user' | 'moderator'

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
```

## Discriminated union avec exhaustive handler
```typescript
type Action =
  | { type: 'INCREMENT'; payload: number }
  | { type: 'DECREMENT'; payload: number }
  | { type: 'RESET' };

function reducer(state: number, action: Action): number {
  switch (action.type) {
    case 'INCREMENT': return state + action.payload;
    case 'DECREMENT': return state - action.payload;
    case 'RESET': return 0;
    default: {
      const _: never = action;
      return state;
    }
  }
}
```
