# Directive Composition API (`hostDirectives`) — Reference

> Voir aussi [`14-host-elements.md`](./14-host-elements.md) pour les bindings sur l'element hote (`host: {}`).

## Concept

`hostDirectives` (Angular 15+) permet d'attacher des **directives** directement sur l'element hote d'un composant (ou d'une autre directive), au niveau du decorateur `@Component` / `@Directive`. Le composant se comporte comme si la directive etait appliquee dessus — sans heritage, sans intervention du template parent.

Objectif : factoriser un **comportement transverse** (styles, ARIA, interactions DOM, animations) en un seul endroit et le composer dans plusieurs composants.

## Quand utiliser

| Cas | `hostDirectives` ? |
|-----|---------------------|
| Meme combinaison de classes/ARIA/event sur 3+ composants | Oui |
| Comportement DOM reutilisable (ripple, focus trap, escape-to-close) | Oui |
| Logique metier, validation, appel HTTP | **Non** (use case / service) |
| Variation visuelle d'un seul composant (`variant`) | **Non** (`input()` + `computed()`) |
| Besoin de projeter du DOM conditionnel | **Non** seul — combiner avec `inject(MyDirective)` dans le composant |

## Pattern de base

### 1) Extraire le comportement dans une directive standalone

```typescript
// loading.ts
import { Directive, input } from '@angular/core';

@Directive({
  selector: '[loading]',
  host: {
    '[class.animate-pulse]': 'loading()',
    '[attr.aria-busy]': 'loading() ? "true" : null',
  },
})
export class Loading {
  readonly loading = input(false);
}
```

### 2) Composer dans le composant via `hostDirectives`

```typescript
// admin-stat-card.ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Loading } from '@shared/ui/loading';

@Component({
  selector: 'admin-stat-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: Loading,
      inputs: ['loading'], // expose tel quel sur l'API du composant
    },
  ],
  host: { class: 'block rounded-xl border border-foreground/10 p-4' },
  template: `<ng-content />`,
})
export class AdminStatCard {}
```

### 3) Consommer depuis le parent

```html
<admin-stat-card [loading]="isLoading()">
  <span>{{ count() }}</span>
</admin-stat-card>
```

La directive `Loading` est appliquee sur l'element hote `<admin-stat-card>`. Les classes et l'attribut `aria-busy` viennent de la directive, sans aucune ligne dans `AdminStatCard`.

## Inputs / Outputs : opt-in explicite

Par defaut, **aucun input ni output** d'une `hostDirective` n'est expose a l'exterieur — c'est volontaire (l'API publique du composant reste maitrisee).

```typescript
hostDirectives: [
  {
    directive: Tooltip,
    inputs: [
      'tooltipText: hint',        // 'nomInterne: nomExpose'
      'tooltipPosition',          // expose tel quel
    ],
    outputs: [
      'tooltipShown: hintShown',  // rename a l'export
    ],
  },
],
```

| Syntaxe | Effet |
|---------|-------|
| `'foo'` | Expose `foo` tel quel |
| `'foo: bar'` | Expose `foo` sous le nom `bar` cote parent |

## Composer plusieurs directives

```typescript
hostDirectives: [
  { directive: Loading, inputs: ['loading'] },
  { directive: EscapeToClose, outputs: ['escaped: closed'] },
],
```

Tu peux egalement creer une directive d'ordre superieur qui en regroupe d'autres :

```typescript
// interactive.ts
@Directive({
  selector: '[interactive]',
  hostDirectives: [
    { directive: Ripple },
    { directive: FocusVisible },
    { directive: Loading, inputs: ['loading'] },
  ],
})
export class Interactive {}
```

## Acceder a la directive depuis le composant qui la compose

`inject()` fonctionne sur toute directive declaree dans `hostDirectives` — utile pour lire son etat dans le template ou la logique :

```typescript
@Component({
  selector: 'submit-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    { directive: Loading, inputs: ['loading'] },
  ],
  template: `
    <button type="submit">
      @if (loadingDir.loading()) {
        <app-icon name="spinner" [size]="20" class="animate-spin" />
      }
      <ng-content />
    </button>
  `,
})
export class SubmitButton {
  protected readonly loadingDir = inject(Loading);
}
```

## Regles importantes

- **Le `selector` de la directive est ignore** quand elle est utilisee via `hostDirectives`. C'est le composant hote qui determine ou elle s'applique.
- **Aucun template** dans une directive — si tu as besoin de DOM conditionnel, fais-le dans le template du composant en injectant la directive.
- **Standalone obligatoire** (le cas par defaut depuis v19).
- **Collisions avec `host: {}` du composant** : memes regles que les collisions host vs template (cf. `14-host-elements.md`). Le binding dynamique gagne sur le statique.
- **Inputs requis** (`input.required<T>()`) d'une hostDirective non exposee → erreur runtime si le parent ne peut pas la passer. Reserve les `required` aux directives dont l'input **est** expose, ou donne une valeur par defaut.

## Cas d'usage concrets J-Ned — quand ?

**Pas maintenant** (YAGNI / pas atteint le seuil 3+) :
- Les `animate-pulse` (~25) sont dans `@if (isLoading()) { <div animate-pulse> } @else { ... }` — le placeholder n'existe que pendant le loading. Solution adaptee = **composant `<app-skeleton>`**, pas un `hostDirective`.
- Spinner + `aria-busy` sur submit button : 1 seul usage (`contact-form.ts`).
- `(document:keydown.escape)` : 1 seul usage (`drawer.ts`).

**Declencheurs futurs** ou il faudra extraire :

### Cas 1 — 2+ overlays (drawer + modal + popover)

```typescript
// shared/ui/escape-to-close.ts
@Directive({
  selector: '[escapeToClose]',
  host: { '(document:keydown.escape)': 'escaped.emit()' },
})
export class EscapeToClose {
  readonly escaped = output<void>();
}

// drawer.ts / modal.ts / popover.ts
hostDirectives: [
  { directive: EscapeToClose, outputs: ['escaped: closed'] },
],
```

Generalement combine avec un `FocusTrap` et un `BodyScrollLock` dans une directive d'ordre superieur `Overlay`.

### Cas 2 — 3+ boutons avec etat loading (submit, save, delete async)

```typescript
// shared/ui/loading-button.ts
@Directive({
  selector: '[loadingButton]',
  host: {
    '[attr.aria-busy]': 'loading() ? "true" : null',
    '[attr.disabled]': 'loading() || null',
  },
})
export class LoadingButton {
  readonly loading = input(false);
}

// submit-button.ts
hostDirectives: [
  { directive: LoadingButton, inputs: ['loading'] },
],
```

## Ce que `hostDirectives` ne remplace pas

| Besoin | Outil |
|--------|-------|
| Variation de style d'un seul composant | `input()` + `computed()` (cf. `tag.ts`, `button.ts`) |
| Etat local complexe avec logique | Composant dedie |
| Logique metier / orchestration | Use case (cf. `07-clean-architecture.md`) |
| Partage de **donnees** entre composants | Service / Store / Signal partage |

## Heritage : pourquoi `extends` est mauvais ici

L'instinct OOP pousse vers une classe de base :

```typescript
// Anti-pattern
abstract class DisabledBase {
  readonly disabled = input(false);
}
@Component({ ... })
export class Button extends DisabledBase {}
```

Problemes :
- Heritage simple — bloque la composition de 2+ comportements
- `input()` dans une classe de base cree des frictions avec la detection de changement
- Couplage fort, difficile a tester unitairement
- `hostDirectives` resout exactement ce probleme **par composition**

## Checklist d'application

1. Reperer une duplication d'host bindings sur **3+ composants** (sinon YAGNI)
2. Extraire dans une `@Directive` standalone avec ses propres `input()` / `output()` et bindings dans `host: {}`
3. Composer via `hostDirectives` + mapping explicite des inputs/outputs
4. Tester la directive isolement (applique-la sur un `<div>` de test, verifie les bindings DOM)
5. Si tu en composes 3+, creer une directive d'ordre superieur qui regroupe la famille
