# Elements hotes (Host Elements) Angular — Reference

> Pour **composer** plusieurs comportements `host: {}` reutilisables sur differents composants sans heritage, voir [`20-host-directives.md`](./20-host-directives.md) (Directive Composition API).

## Concept

Chaque composant Angular a un **element hote** — l'element DOM qui correspond au selecteur du composant. Par exemple, `<app-banner>` est l'element hote de `BannerComponent`.

La propriete `host` de `@Component` permet de binder des attributs, classes, styles, proprietes et evenements directement sur cet element hote.

## Propriete `host` dans @Component (methode recommandee)

### Attributs statiques

```typescript
@Component({
  selector: 'app-banner',
  host: {
    'role': 'banner',
    'tabindex': '0',
    'aria-live': 'polite',
    'data-component': 'banner',
  },
  template: `<ng-content />`,
})
export class BannerComponent {}
```

Resultat HTML :
```html
<app-banner role="banner" tabindex="0" aria-live="polite" data-component="banner">
  ...
</app-banner>
```

### Binding d'attribut dynamique

```typescript
host: {
  '[attr.aria-label]': 'ariaLabel()',
  '[attr.aria-expanded]': 'isOpen()',
  '[attr.data-status]': 'status()',
}
```

### Binding de classe

```typescript
host: {
  '[class.active]': 'isActive()',
  '[class.disabled]': 'isDisabled()',
  '[class.has-error]': 'hasError()',
}
```

### Binding de style

```typescript
host: {
  '[style.color]': 'textColor()',
  '[style.width.px]': 'widthInPx()',
  '[style.opacity]': 'isVisible() ? 1 : 0.5',
  '[style.display]': '"flex"',  // valeur statique entre guillemets simples + doubles
}
```

### Binding de propriete

```typescript
host: {
  '[disabled]': 'isDisabled()',
  '[hidden]': 'isHidden()',
  '[id]': 'componentId()',
}
```

### Binding d'evenement

```typescript
host: {
  '(click)': 'onClick($event)',
  '(keydown.enter)': 'onEnter()',
  '(keydown.escape)': 'onEscape()',
  '(focus)': 'onFocus()',
  '(blur)': 'onBlur()',
  '(window:resize)': 'onResize($event)',
  '(document:keydown)': 'onGlobalKey($event)',
}
```

### Exemple complet

```typescript
@Component({
  selector: 'app-dropdown',
  host: {
    'role': 'listbox',
    '[attr.aria-expanded]': 'isOpen()',
    '[attr.aria-label]': 'label()',
    '[class.open]': 'isOpen()',
    '[class.disabled]': 'disabled()',
    '[style.width.px]': 'width()',
    '(click)': 'toggle()',
    '(keydown.escape)': 'close()',
    '(document:click)': 'onOutsideClick($event)',
  },
  template: `
    <div class="dropdown-trigger">
      <ng-content select="[trigger]" />
    </div>
    @if (isOpen()) {
      <div class="dropdown-content">
        <ng-content />
      </div>
    }
  `,
})
export class DropdownComponent {
  readonly label = input('');
  readonly disabled = input(false);
  readonly width = input(200);

  protected readonly isOpen = signal(false);

  protected toggle() {
    if (!this.disabled()) {
      this.isOpen.update(v => !v);
    }
  }

  protected close() {
    this.isOpen.set(false);
  }

  protected onOutsideClick(event: MouseEvent) {
    // Fermer si clic en dehors
  }
}
```

## Legacy : @HostBinding / @HostListener (a eviter dans le nouveau code)

```typescript
// ANCIEN STYLE — preferer host: {} dans @Component
@Component({ selector: 'app-card' })
export class CardComponent {
  @HostBinding('class.active')
  isActive = false;

  @HostBinding('attr.role')
  role = 'article';

  @HostBinding('style.borderColor')
  get borderColor() {
    return this.isActive ? 'blue' : 'gray';
  }

  @HostListener('click')
  onClick() {
    this.isActive = !this.isActive;
  }

  @HostListener('keydown.enter', ['$event'])
  onEnter(event: KeyboardEvent) {
    event.preventDefault();
    this.onClick();
  }
}
```

### Pourquoi eviter @HostBinding / @HostListener

- Moins lisible — les bindings sont eparpilles dans la classe
- `host: {}` centralise tous les bindings au meme endroit
- `host: {}` est coherent avec la syntaxe du template
- Les decorateurs sont une ancienne API, `host` est l'approche moderne

## Regles de collision de bindings

Quand le meme attribut est defini a la fois dans le composant (`host`) et par le parent (template) :

| Situation | Regle |
|-----------|-------|
| Attribut statique `host` + attribut statique template | **Template gagne** |
| Binding dynamique `host` + binding dynamique template | **Template gagne** |
| Attribut statique + binding dynamique (meme attribut) | **Dynamique gagne toujours** |
| `[class.x]` dans `host` + `[class.x]` dans template | **Les deux s'appliquent** (merge) |
| `[style.x]` dans `host` + `[style.x]` dans template | **Template gagne** |

```typescript
// Composant
@Component({
  selector: 'app-box',
  host: {
    'role': 'region',           // statique
    '[class.highlight]': 'isHighlighted()',  // dynamique
    '[style.color]': '"blue"',  // dynamique
  },
})
export class BoxComponent {}
```

```html
<!-- Template parent -->
<app-box role="main" [class.highlight]="false" [style.color]="'red'" />
<!-- Resultat : role="main" (template gagne), classes mergees, color="red" (template gagne) -->
```

## HostAttributeToken — lire un attribut statique du host

Permet a un composant de lire un attribut HTML statique place sur son element hote par le parent.

```typescript
import { HostAttributeToken } from '@angular/core';

@Component({
  selector: 'app-icon',
  template: `<span class="icon icon-{{ name }}"></span>`,
})
export class IconComponent {
  // Lit l'attribut "name" place sur <app-icon name="star" />
  protected readonly name = inject(new HostAttributeToken('name'));
}

@Component({
  selector: 'app-card',
  template: `<div [class]="'card card-' + variant">...</div>`,
})
export class CardComponent {
  // Optionnel — valeur par defaut si l'attribut n'est pas present
  protected readonly variant = inject(new HostAttributeToken('variant'), { optional: true }) ?? 'default';
}
```

```html
<!-- Utilisation -->
<app-icon name="star" />
<app-icon name="close" />
<app-card variant="outlined" />
<app-card />  <!-- variant = 'default' -->
```

### Difference avec input()

| | `input()` | `HostAttributeToken` |
|---|-----------|---------------------|
| Type de binding | Dynamique (`[attr]="expr"`) | Statique (`attr="value"`) |
| Reactif | Oui (Signal) | Non (valeur fixe) |
| Cas d'usage | Donnees qui changent | Configuration fixe a l'instantiation |
| Disponible dans | Template | `inject()` (constructeur, champs) |
