# Composants Angular — Reference

## Creation et structure

- `@Component` decorator avec : `selector` (kebab-case, **sans prefixe**), `template`, `styles`
- Standalone implicite depuis v19 — ne **pas** declarer `standalone: true`
- Classe en PascalCase, **sans suffixe** `Component` : `UserCard`
- Fichier en kebab-case, **sans suffixe** `.component` : `user-card.ts`
- SFC (Single File Component) prefere : inline template + inline styles, template en **dernier**
- Balises auto-fermantes : `<user-card />`

### Configuration `angular.json` (obligatoire)

```json
{
  "schematics": {
    "@schematics/angular:component": {
      "type": "",
      "prefix": ""
    }
  }
}
```

- `"type": ""` — genere `user-card.ts` au lieu de `user-card.component.ts`, et `UserCard` au lieu de `UserCardComponent`
- `"prefix": ""` — genere `selector: 'user-card'` au lieu de `selector: 'app-user-card'`

```typescript
@Component({
  selector: 'user-card',
  imports: [DatePipe],
  styles: `
    :host { display: block; }
    .card { padding: 1rem; border: 1px solid #ccc; border-radius: 8px; }
  `,
  template: `
    <div class="card">
      <h3>{{ name() }}</h3>
      <p>Inscrit le {{ createdAt() | date:'longDate' }}</p>
    </div>
  `,
})
export class UserCard {
  readonly name = input.required<string>();
  readonly createdAt = input.required<Date>();
}
```

## Inputs (signal-based)

```typescript
readonly value = input(0);                    // avec default, type infere
readonly content = input.required<string>();   // requis, type explicite
// InputSignal<number>, InputSignal<string>
```

- Toujours `readonly`
- `computed()` pour deriver des valeurs depuis un input
- Transforms : `input('', { transform: trimString })`, `booleanAttribute`, `numberAttribute`
- Alias : `input(0, { alias: 'sliderValue' })`

```typescript
// Exemple avec transform
readonly disabled = input(false, { transform: booleanAttribute });
// <app-button disabled />  →  true
// <app-button />           →  false

readonly size = input(0, { transform: numberAttribute });
// <app-slider size="42" />  →  42

// Alias
readonly value = input(0, { alias: 'sliderValue' });
// <app-slider sliderValue="10" />
```

## Model inputs (two-way binding)

```typescript
value = model(0);
// Parent : <custom-slider [(value)]="volume" />

increment() {
  this.value.update(v => v + 10);
}
```

- Genere automatiquement un output `valueChange`
- `model.required<T>()` pour le rendre obligatoire
- Pas `readonly` car writable par design

## Outputs

```typescript
readonly panelClosed = output<void>();
readonly valueChanged = output<number>();

// Emission
close() {
  this.panelClosed.emit();
}

update(newValue: number) {
  this.valueChanged.emit(newValue);
}
```

```html
<!-- Template parent -->
<app-panel (panelClosed)="onClose()" (valueChanged)="onValueChange($event)" />
```

- Ne pas reutiliser des noms d'evenements natifs (`click`, `focus`, etc.)
- CamelCase, pas de prefixe `on`
- `outputFromObservable(obs$)` pour convertir un Observable en output

## Visibilite

| Modificateur | Usage |
|-------------|-------|
| `private` | Services injectes, methodes internes |
| `protected` | Proprietes et methodes liees au template |
| `readonly` | Signals, inputs, outputs |

```typescript
export class UserList {
  // Private — service injecte, pas utilise dans le template
  private readonly userService = inject(UserService);

  // Protected — utilise dans le template
  protected readonly users = toSignal(this.userService.getUsers(), { initialValue: [] });

  // Readonly — input signal
  readonly filter = input('');
}
```

## Smart vs Dumb (EAK)

### Smart components (pages / containers)
- Connaissent les use cases et les services
- Orchestrent la communication entre composants via input/output
- Convertissent les Observables en Signals a la frontiere (`toSignal()`)
- Se trouvent dans `pages/` ou au niveau route

### Dumb components (presentational)
- Recoivent **toutes** leurs donnees via `input()`
- Communiquent vers le parent via `output()`
- Zero injection de service
- Se trouvent dans `components/`
- Facilement testables et reutilisables

```typescript
// Smart component (page)
@Component({
  selector: 'user-list-page',
  imports: [UserList],
  template: `
    <user-list [users]="users()" (userSelected)="onSelect($event)" />
  `,
})
export class UserListPage {
  private readonly userUseCase = inject(GetUsersUseCase);
  protected readonly users = toSignal(this.userUseCase.execute(), { initialValue: [] });

  protected onSelect(user: User) {
    // navigation, etc.
  }
}

// Dumb component
@Component({
  selector: 'user-list',
  template: `
    @for (user of users(); track user.id) {
      <div (click)="userSelected.emit(user)">{{ user.name }}</div>
    } @empty {
      <p>Aucun utilisateur</p>
    }
  `,
})
export class UserList {
  readonly users = input.required<User[]>();
  readonly userSelected = output<User>();
}
```

### @let dans les templates

```html
@let user = currentUser();
@let fullName = user.firstName + ' ' + user.lastName;
<h1>{{ fullName }}</h1>
<p>{{ user.email }}</p>
```

- Evite les lectures multiples de signals (performance)
- Elimine les non-null assertions repetitives

## Lifecycle

| Hook | Moment | Usage |
|------|--------|-------|
| `constructor` | Instantiation | Injection context, `effect()`, `afterRenderEffect()` |
| `ngOnInit` | Une fois, apres initialisation des inputs | Logique d'initialisation |
| `ngOnChanges` | A chaque changement d'input (avant `ngOnInit`) | Reagir aux changements (preferer `computed()`) |
| `ngOnDestroy` | A la destruction | Nettoyage (preferer `DestroyRef`) |

### DestroyRef

```typescript
private readonly destroyRef = inject(DestroyRef);

constructor() {
  this.destroyRef.onDestroy(() => {
    // cleanup logic
  });
}
```

### afterNextRender

```typescript
constructor() {
  afterNextRender(() => {
    // Runs once after the next DOM render
    // Utile pour les libs DOM tierces (charts, maps)
  });
}
```

### afterRenderEffect

```typescript
constructor() {
  afterRenderEffect(() => {
    // Runs after every render when les signals lus changent
    chart.updateData(this.chartData());
  });
}
```

Phases disponibles : `earlyRead`, `write`, `mixedReadWrite` (defaut, a eviter), `read`

```typescript
afterRenderEffect({
  earlyRead: () => {
    return this.elementRef.nativeElement.getBoundingClientRect();
  },
  write: (rect) => {
    this.renderer.setStyle(this.el, 'width', `${rect.width}px`);
  },
});
```

## Elements hotes (host)

Chaque composant a un **element hote** — l'element DOM correspondant a son selecteur. Utiliser la propriete `host` de `@Component` pour binder attributs, classes, styles et evenements sur l'element hote.

### Propriete `host` (methode recommandee)

```typescript
@Component({
  selector: 'ui-banner',
  host: {
    // Attribut statique
    'role': 'banner',
    'tabindex': '0',

    // Binding d'attribut dynamique
    '[attr.aria-label]': 'label()',

    // Binding de classe
    '[class.active]': 'isActive()',

    // Binding de style
    '[style.color]': 'textColor()',
    '[style.width.px]': 'width()',

    // Binding de propriete
    '[disabled]': 'isDisabled()',

    // Evenements
    '(click)': 'onClick($event)',
    '(keydown.enter)': 'onEnter()',
  },
  template: `<ng-content />`,
})
export class Banner {
  readonly label = input('');
  readonly isActive = input(false);
  readonly isDisabled = input(false);

  protected textColor = computed(() => this.isActive() ? 'green' : 'gray');
  protected width = signal(200);

  protected onClick(event: MouseEvent) { /* ... */ }
  protected onEnter() { /* ... */ }
}
```

### HostAttributeToken — lire un attribut statique du host

```typescript
import { HostAttributeToken } from '@angular/core';

@Component({
  selector: 'ui-card',
  template: `<p>Variant: {{ variant }}</p>`,
})
export class Card {
  // Lit l'attribut statique "variant" place sur le host par le parent
  private readonly variant = inject(new HostAttributeToken('variant'), { optional: true }) ?? 'default';
}
```

```html
<!-- Utilisation par le parent -->
<ui-card variant="outlined" />
<ui-card variant="elevated" />
<ui-card />  <!-- variant = 'default' -->
```

### Legacy @HostBinding / @HostListener (a eviter dans le nouveau code)

```typescript
// ANCIEN STYLE — utiliser host: {} a la place
@HostBinding('class.active') isActive = false;
@HostListener('click') onClick() { /* ... */ }
```

### Regles de collision de bindings

| Situation | Regle |
|-----------|-------|
| Attribut statique dans `host` + attribut statique dans le template | Template gagne |
| Binding dynamique dans `host` + binding dynamique dans le template | Template gagne |
| Statique + dynamique sur le meme attribut | Dynamique gagne toujours |
| Deux bindings `[class.x]` (host + template) | Les deux s'appliquent (merge) |
| Deux bindings `[style.x]` (host + template) | Template gagne |

## Nommage des composants

**Convention** : pas de suffixe `Component`, pas de prefixe `app-`.

| Element | Convention | Exemple |
|---------|-----------|---------|
| Fichier | kebab-case `.ts` | `user-card.ts` |
| Classe | PascalCase | `UserCard` |
| Selecteur | kebab-case sans prefixe | `user-card` |
| Balise | auto-fermante | `<user-card />` |

Pour les composants partages/UI generiques, un prefixe semantique est acceptable : `ui-card`, `ui-button`.
