# Control Flow Angular — Reference (v17+)

## @if / @else if / @else

```html
@if (user(); as user) {
  <p>{{ user.name }}</p>
} @else if (isLoading()) {
  <p>Chargement...</p>
} @else {
  <p>Aucun utilisateur</p>
}
```

- `as` pour sauvegarder le resultat dans une variable locale (utile pour le narrowing)
- Les conditions sont des expressions JavaScript standard
- Le contenu non-actif est **detruit** (pas juste cache)

```html
<!-- Combinaison avec signals -->
@if (users().length > 0; as hasUsers) {
  <p>{{ users().length }} utilisateurs</p>
} @else {
  <p>Liste vide</p>
}
```

## @for

```html
@for (item of items(); track item.id) {
  <div>{{ item.name }}</div>
} @empty {
  <p>Aucun element</p>
}
```

### track — obligatoire

- **ID unique prefere** : `track item.id` — meilleure performance de reconciliation
- `track $index` — fallback quand les items n'ont pas d'ID unique
- Ne **jamais** tracker par l'objet entier sauf pour les types primitifs

```html
<!-- Primitives : track par valeur -->
@for (name of names(); track name) {
  <span>{{ name }}</span>
}

<!-- Objets : track par ID -->
@for (user of users(); track user.id) {
  <app-user-card [user]="user" />
}
```

### Variables implicites

| Variable | Type | Description |
|----------|------|-------------|
| `$index` | `number` | Index de l'element courant |
| `$first` | `boolean` | Premier element |
| `$last` | `boolean` | Dernier element |
| `$even` | `boolean` | Index pair |
| `$odd` | `boolean` | Index impair |
| `$count` | `number` | Nombre total d'elements |

### Alias

```html
@for (item of items(); track item.id; let idx = $index, isEven = $even) {
  <div [class.even]="isEven">
    {{ idx + 1 }}. {{ item.name }}
  </div>
}
```

### @empty — listes vides

```html
@for (item of items(); track item.id) {
  <app-item [item]="item" />
} @empty {
  <div class="empty-state">
    <p>Aucun element trouve</p>
    <button (click)="addItem()">Ajouter</button>
  </div>
}
```

## @switch

```html
@switch (status()) {
  @case ('active') { <span class="badge green">Actif</span> }
  @case ('inactive') { <span class="badge gray">Inactif</span> }
  @case ('banned') { <span class="badge red">Banni</span> }
  @default { <span class="badge">Inconnu</span> }
}
```

- Comparaison **stricte** (`===`), pas de fallthrough
- `@default` est optionnel
- `@default { never; }` — pour le type checking exhaustif (erreur de compilation si un cas manque)

## @let

```html
@let user = currentUser();
@let greeting = 'Hello, ' + user.name;
@let itemCount = items().length;
<p>{{ greeting }} — {{ itemCount }} elements</p>
```

### Avantages

- **Evite les lectures multiples de signals** (une seule lecture, stockee dans une variable)
- **Elimine les non-null assertions** : `@let user = currentUser()` puis utiliser `user.name` sans `!`
- **Simplifie les expressions complexes** dans le template

```html
<!-- Sans @let : lecture multiple du signal -->
<p>{{ currentUser().firstName }} {{ currentUser().lastName }}</p>
<p>{{ currentUser().email }}</p>

<!-- Avec @let : une seule lecture -->
@let user = currentUser();
<p>{{ user.firstName }} {{ user.lastName }}</p>
<p>{{ user.email }}</p>
```

### Portee

- `@let` est scope au bloc dans lequel il est declare
- Accessible dans les blocs enfants mais pas en dehors

```html
@if (showDetails()) {
  @let details = computeDetails();
  <p>{{ details.summary }}</p>
}
<!-- details n'est PAS accessible ici -->
```

## @defer

```html
@defer (on viewport; prefetch on idle) {
  <heavy-component />
} @placeholder (minimum 500ms) {
  <p>Placeholder</p>
} @loading (after 100ms; minimum 1s) {
  <p>Chargement...</p>
} @error {
  <p>Erreur de chargement</p>
}
```

### Triggers

| Trigger | Description |
|---------|-------------|
| `on idle` | Quand le navigateur est idle (defaut) |
| `on viewport` | Quand l'element entre dans le viewport |
| `on interaction` | Au click ou keydown |
| `on hover` | Au mouseover ou focusin |
| `on immediate` | Immediatement apres le rendu initial |
| `on timer(500ms)` | Apres un delai specifie |
| `when condition` | Quand la condition est truthy (one-time, ne se re-declenche pas) |

### Prefetch

```html
@defer (on interaction; prefetch on idle) {
  <dashboard-widget />
}
```

- Charger les ressources (JS bundle) **avant** l'affichage
- Le trigger de prefetch et le trigger d'affichage sont independants
- Plusieurs triggers separes par `;` (OR logique)

```html
@defer (on viewport; on timer(5s); prefetch on idle) {
  <heavy-component />
}
```

### Blocs optionnels

| Bloc | Options | Description |
|------|---------|-------------|
| `@placeholder` | `minimum` | Contenu affiche avant le chargement |
| `@loading` | `after`, `minimum` | Contenu affiche pendant le chargement |
| `@error` | — | Contenu affiche si le chargement echoue |

Voir `12-defer.md` pour la reference complete sur `@defer`.
