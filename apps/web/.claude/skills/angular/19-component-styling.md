# Styling des composants Angular — Reference

## Styles inline vs fichiers externes

### Styles inline (recommande pour SFC)

```typescript
@Component({
  selector: 'app-card',
  styles: `
    :host {
      display: block;
      padding: 1rem;
    }
    .title {
      font-size: 1.5rem;
      font-weight: bold;
    }
  `,
  template: `
    <h2 class="title">{{ title() }}</h2>
    <ng-content />
  `,
})
export class CardComponent {
  readonly title = input.required<string>();
}
```

### Fichiers externes

```typescript
@Component({
  selector: 'app-card',
  styleUrl: './card.component.css',
  templateUrl: './card.component.html',
})
export class CardComponent {}
```

### Plusieurs fichiers de styles

```typescript
@Component({
  styleUrls: ['./card.component.css', './card.theme.css'],
})
```

## Encapsulation de vue

Angular encapsule les styles de chaque composant pour eviter les fuites.

### ViewEncapsulation.Emulated (defaut)

Ajoute des attributs uniques (`_ngcontent-xxx`) aux elements et selecteurs. Les styles ne s'appliquent qu'aux elements du composant.

```typescript
import { ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-card',
  encapsulation: ViewEncapsulation.Emulated, // defaut — pas besoin de le declarer
  styles: `
    p { color: blue; }  /* Compile en : p[_ngcontent-abc] { color: blue; } */
  `,
  template: `<p>Ce texte est bleu</p>`,
})
export class CardComponent {}
```

### ViewEncapsulation.ShadowDom

Utilise le vrai Shadow DOM du navigateur. Isolation complete.

```typescript
@Component({
  selector: 'app-widget',
  encapsulation: ViewEncapsulation.ShadowDom,
  styles: `
    /* Ces styles sont completement isoles dans le Shadow DOM */
    p { color: red; }
    :host { display: block; border: 1px solid #ccc; }
  `,
  template: `<p>Isole dans le Shadow DOM</p>`,
})
export class WidgetComponent {}
```

| Aspect | Emulated | ShadowDom |
|--------|----------|-----------|
| Mecanisme | Attributs generes | Shadow DOM natif |
| Isolation | Partielle (selecteurs scopes) | Complete |
| Styles globaux | S'appliquent | **Ne s'appliquent PAS** |
| Support navigateur | Tous | Navigateurs modernes |
| `::ng-deep` | Oui | Non |

### ViewEncapsulation.None

Pas d'encapsulation — les styles sont globaux.

```typescript
@Component({
  selector: 'app-global-styles',
  encapsulation: ViewEncapsulation.None,
  styles: `
    /* ATTENTION : ces styles s'appliquent a TOUTE l'application */
    .danger { color: red; }
  `,
  template: `<p class="danger">Style global</p>`,
})
export class GlobalStylesComponent {}
```

> **A eviter** sauf pour des cas tres specifiques (themes, styles de reset).

## Selecteurs speciaux

### :host — cibler l'element hote

```css
/* Cibler l'element hote du composant (<app-card>) */
:host {
  display: block;
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
}

/* Cibler l'element hote quand il a une classe specifique */
:host(.highlighted) {
  border-color: blue;
  box-shadow: 0 0 5px rgba(0, 0, 255, 0.3);
}

/* Cibler l'element hote quand il a un attribut */
:host([disabled]) {
  opacity: 0.5;
  pointer-events: none;
}
```

### :host-context() — cibler selon un ancetre

```css
/* S'applique quand un ancetre a la classe .dark-theme */
:host-context(.dark-theme) {
  background: #333;
  color: white;
}

:host-context(.compact) .card-body {
  padding: 0.5rem;
}
```

### ::ng-deep (deconseille)

Permet de percer l'encapsulation pour styler les composants enfants.

```css
/* DECONSEILLE — casse l'encapsulation */
:host ::ng-deep .child-component-class {
  color: red;
}
```

> **Alternatives a ::ng-deep** :
> - Utiliser des variables CSS custom (`--my-color`) definies dans le parent et lues dans l'enfant
> - Utiliser `ViewEncapsulation.None` sur le composant enfant (si on le controle)
> - Passer les styles via des inputs

```css
/* Alternative avec variables CSS */
:host {
  --card-bg: white;
  --card-border: #ddd;
}

/* Dans le composant enfant */
:host {
  background: var(--card-bg, white);
  border-color: var(--card-border, #ddd);
}
```

## Tailwind CSS v4 — setup avec Angular

### Installation

```bash
ng add tailwindcss
```

La commande `ng add` configure automatiquement le projet.

### Import (Tailwind CSS v4)

```css
/* styles.css — point d'entree global */
@import 'tailwindcss';
```

> **IMPORTANT — changements Tailwind v4** :
> - Utiliser `@import 'tailwindcss'` — PAS les anciennes directives `@tailwind base/components/utilities`
> - **PAS de fichier `tailwind.config.js`** en v4 — la configuration se fait dans le CSS
> - Les plugins se declarent via `@plugin` dans le CSS

### Configuration dans le CSS (v4)

```css
/* styles.css */
@import 'tailwindcss';

/* Configuration via @theme — remplace tailwind.config.js */
@theme {
  --color-primary: #3b82f6;
  --color-secondary: #64748b;
  --font-sans: 'Inter', sans-serif;
  --breakpoint-3xl: 1920px;
}

/* Plugins */
@plugin '@tailwindcss/forms';
@plugin '@tailwindcss/typography';
```

### Utilisation dans les composants

```typescript
@Component({
  selector: 'app-button',
  template: `
    <button
      class="px-4 py-2 rounded-lg font-medium
             bg-primary text-white
             hover:bg-primary/90
             disabled:opacity-50 disabled:cursor-not-allowed
             transition-colors duration-200"
      [disabled]="disabled()"
    >
      <ng-content />
    </button>
  `,
})
export class ButtonComponent {
  readonly disabled = input(false);
}
```

### Styles conditionnels avec Tailwind

```html
<div
  [class]="isActive() ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'"
  class="p-4 rounded-lg"
>
  Contenu
</div>

<!-- Avec ngClass-like binding -->
<div
  class="p-4 rounded-lg"
  [class.bg-blue-500]="isActive()"
  [class.text-white]="isActive()"
  [class.bg-gray-100]="!isActive()"
>
  Contenu
</div>
```

## Bonnes pratiques

| Pratique | Recommandation |
|----------|---------------|
| Encapsulation | Garder `Emulated` (defaut) |
| `:host` | Toujours definir `display` sur `:host` |
| `::ng-deep` | Eviter — utiliser des variables CSS |
| Styles inline | Preferer pour les SFC (petits composants) |
| Tailwind v4 | `@import 'tailwindcss'`, pas de `tailwind.config.js` |
| Styles globaux | Dans `styles.css` uniquement |
| Variables CSS | Preferer pour la communication parent-enfant |
