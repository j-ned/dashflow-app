# Resource API Angular — Reference (experimental v19+)

## resource() — pour fetch natif / Promises

```typescript
import { resource } from '@angular/core';

const userResource = resource({
  params: () => ({ id: userId() }),
  loader: ({ params, abortSignal }) =>
    fetch(`/api/users/${params.id}`, { signal: abortSignal })
      .then(res => res.json()),
});
```

- `params` : fonction reactive qui retourne les parametres — re-execute le loader quand les signals lus changent
- `loader` : fonction async qui recoit `params` et un `abortSignal`
- Si `params` retourne `undefined`, le loader n'est pas execute (status `idle`)

```typescript
// Params conditionnels
const userResource = resource({
  params: () => {
    const id = userId();
    return id ? { id } : undefined; // idle si pas d'id
  },
  loader: ({ params, abortSignal }) =>
    fetch(`/api/users/${params.id}`, { signal: abortSignal }).then(r => r.json()),
});
```

## rxResource() — pour HttpClient / Observables

```typescript
import { rxResource } from '@angular/core/rxjs-interop';

const userResource = rxResource({
  params: () => ({ userId: userId() }),
  stream: ({ params }) => this.userService.getUser(params.userId),
});
```

- `stream` au lieu de `loader` — retourne un `Observable<T>`
- Se desinscrit automatiquement quand les params changent ou a la destruction
- Meme API que `resource()` pour le reste

## httpResource() — pour les GET simples

```typescript
import { httpResource } from '@angular/common/http';

// One-liner pour un GET simple
const config = httpResource<Config>('/api/config');

// Avec URL reactive
const user = httpResource<User>(() => `/api/users/${userId()}`);

// Avec options completes
const users = httpResource<User[]>(() => ({
  url: '/api/users',
  method: 'GET',
  params: { page: page().toString(), limit: '20' },
  headers: { 'Accept': 'application/json' },
}));

// Parsers specifiques
const text = httpResource.text('/api/health');        // Signal<string | undefined>
const blob = httpResource.blob('/api/file');           // Signal<Blob | undefined>
const buffer = httpResource.arrayBuffer('/api/data');  // Signal<ArrayBuffer | undefined>
```

## ResourceRef — proprietes communes

| Propriete | Type | Description |
|-----------|------|-------------|
| `value()` | `T \| undefined` | Valeur actuelle |
| `hasValue()` | `boolean` | `true` si une valeur existe |
| `isLoading()` | `boolean` | `true` si le loader est en cours |
| `error()` | `unknown` | Erreur si le loader a echoue |
| `status()` | `ResourceStatus` | Status actuel (voir ci-dessous) |
| `reload()` | `void` | Relancer le loader manuellement |
| `set(value)` | `void` | Modifier la valeur localement |
| `update(fn)` | `void` | Modifier la valeur via une fonction |

## Status

| Status | `value()` | Description |
|--------|-----------|-------------|
| `idle` | `undefined` | Pas de requete valide (params retourne undefined) |
| `loading` | `undefined` | Loader en cours (premiere fois ou params change) |
| `reloading` | Valeur precedente | Loader en cours (apres `reload()`) |
| `resolved` | Valeur resolue | Loader termine avec succes |
| `error` | `undefined` | Loader a echoue |
| `local` | Valeur locale | Valeur definie via `set()` / `update()` |

```typescript
// Utilisation dans le template
@switch (userResource.status()) {
  @case ('idle') { <p>Selectionnez un utilisateur</p> }
  @case ('loading') { <app-spinner /> }
  @case ('reloading') {
    <app-user-card [user]="userResource.value()!" />
    <app-spinner size="small" />
  }
  @case ('resolved') {
    <app-user-card [user]="userResource.value()!" />
  }
  @case ('error') {
    <app-error [error]="userResource.error()" />
    <button (click)="userResource.reload()">Reessayer</button>
  }
}
```

## Annulation automatique

Les requetes en cours sont **automatiquement annulees** quand :
- Les `params` changent (nouvelle requete lancee)
- Le composant/service est detruit

### Avec fetch natif — utiliser abortSignal

```typescript
const data = resource({
  params: () => ({ query: searchQuery() }),
  loader: async ({ params, abortSignal }) => {
    const response = await fetch(
      `/api/search?q=${params.query}`,
      { signal: abortSignal },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },
});
```

### Avec rxResource — l'unsubscribe est automatique

```typescript
const data = rxResource({
  params: () => ({ query: searchQuery() }),
  stream: ({ params }) =>
    this.http.get<Result[]>('/api/search', {
      params: { q: params.query },
    }),
});
```

## Modification locale avec set() / update()

```typescript
// Mise a jour optimiste
async deleteUser(userId: string) {
  // Retirer de la liste immediatement
  this.usersResource.update(users =>
    users?.filter(u => u.id !== userId)
  );

  // Puis supprimer cote serveur
  await fetch(`/api/users/${userId}`, { method: 'DELETE' });
}
```

- `set()` et `update()` mettent le status a `local`
- Le prochain changement de params ou `reload()` repassera par le loader

## Patterns d'utilisation

### Resource dans un service

```typescript
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);

  getUserResource(userId: Signal<string>) {
    return rxResource({
      params: () => ({ id: userId() }),
      stream: ({ params }) => this.http.get<User>(`/api/users/${params.id}`),
    });
  }
}
```

### Combinaison avec computed

```typescript
const userResource = rxResource({ ... });

// Deriver des valeurs depuis la resource
protected readonly userName = computed(() => userResource.value()?.name ?? 'Inconnu');
protected readonly canEdit = computed(() =>
  userResource.status() === 'resolved' && userResource.value()?.role === 'admin'
);
```

### Chargement en cascade

```typescript
const userId = signal<string>('1');

const userResource = rxResource({
  params: () => ({ id: userId() }),
  stream: ({ params }) => this.userService.getUser(params.id),
});

// Depend du resultat de userResource
const ordersResource = rxResource({
  params: () => {
    const user = userResource.value();
    return user ? { userId: user.id } : undefined; // idle tant que user pas charge
  },
  stream: ({ params }) => this.orderService.getOrders(params.userId),
});
```
