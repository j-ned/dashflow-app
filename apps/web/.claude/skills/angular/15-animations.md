# Animations Angular — Reference

## Animations CSS natives (v20.2+ — methode recommandee)

Depuis Angular v20.2, les animations natives CSS sont l'approche recommandee. Plus performantes et plus simples que le DSL legacy.

### animate.enter et animate.leave

Angular ajoute automatiquement les classes `animate.enter` et `animate.leave` sur les elements qui entrent ou sortent du DOM (via `@if`, `@for`, etc.).

```typescript
@Component({
  selector: 'app-toast',
  styles: `
    :host {
      display: block;
    }

    .toast {
      /* Animation d'entree */
      &.animate\\.enter {
        animation: slideIn 300ms ease-out;
      }

      /* Animation de sortie */
      &.animate\\.leave {
        animation: slideOut 300ms ease-in;
      }
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes slideOut {
      from {
        opacity: 1;
        transform: translateY(0);
      }
      to {
        opacity: 0;
        transform: translateY(-20px);
      }
    }
  `,
  template: `
    @if (visible()) {
      <div class="toast">
        <ng-content />
      </div>
    }
  `,
})
export class ToastComponent {
  readonly visible = input(false);
}
```

### AnimationCallbackEvent — callback de fin d'animation

Quand on ecoute les evenements d'animation, il est **OBLIGATOIRE** d'appeler `animationComplete()` pour signaler a Angular que l'animation est terminee.

```typescript
@Component({
  selector: 'app-modal',
  styles: `
    .modal {
      &.animate\\.enter {
        animation: fadeIn 200ms ease-out;
      }
      &.animate\\.leave {
        animation: fadeOut 200ms ease-in;
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `,
  template: `
    @if (isOpen()) {
      <div
        class="modal"
        (animationend)="onAnimationEnd($event)"
      >
        <ng-content />
      </div>
    }
  `,
})
export class ModalComponent {
  readonly isOpen = input(false);

  protected onAnimationEnd(event: AnimationCallbackEvent) {
    // OBLIGATOIRE — signaler a Angular que l'animation est terminee
    event.animationComplete();
  }
}
```

> **CRITIQUE** : ne jamais oublier `animationComplete()`. Sans cet appel, Angular ne retirera pas l'element du DOM apres une animation de sortie.

### Hauteur automatique avec css-grid

Pour animer la hauteur d'un element dont le contenu est dynamique, utiliser le trick css-grid :

```css
.expandable {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 300ms ease;
}

.expandable.open {
  grid-template-rows: 1fr;
}

.expandable > .content {
  overflow: hidden;
}
```

```typescript
@Component({
  selector: 'app-accordion-item',
  styles: `
    .panel {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 300ms ease;
    }

    .panel.open {
      grid-template-rows: 1fr;
    }

    .panel-content {
      overflow: hidden;
    }
  `,
  template: `
    <button (click)="toggle()">{{ title() }}</button>
    <div class="panel" [class.open]="isOpen()">
      <div class="panel-content">
        <ng-content />
      </div>
    </div>
  `,
})
export class AccordionItemComponent {
  readonly title = input.required<string>();
  protected readonly isOpen = signal(false);

  protected toggle() {
    this.isOpen.update(v => !v);
  }
}
```

### Echelonnement (stagger) avec animation-delay

```typescript
@Component({
  selector: 'app-list',
  styles: `
    .item {
      &.animate\\.enter {
        animation: fadeInUp 300ms ease-out both;
        /* Chaque element a un delai calcule par Angular */
        animation-delay: calc(var(--animation-index, 0) * 50ms);
      }
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,
  template: `
    @for (item of items(); track item.id; let i = $index) {
      <div class="item" [style.--animation-index]="i">
        {{ item.name }}
      </div>
    }
  `,
})
export class ListComponent {
  readonly items = input.required<{ id: number; name: string }[]>();
}
```

## Animations DSL legacy (depreciees)

> **ATTENTION** : le DSL d'animations Angular (`@angular/animations`) est **deprecie**. Utiliser les animations CSS natives pour tout nouveau code. Ne JAMAIS mixer legacy et natif dans le meme composant.

### Setup legacy

```typescript
// app.config.ts
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimationsAsync(), // preferer async a provideAnimations()
  ],
};
```

### Syntaxe legacy

```typescript
import { trigger, state, style, animate, transition } from '@angular/animations';

@Component({
  selector: 'app-toggle',
  animations: [
    trigger('openClose', [
      state('open', style({
        height: '200px',
        opacity: 1,
      })),
      state('closed', style({
        height: '100px',
        opacity: 0.8,
      })),
      transition('open => closed', [
        animate('300ms ease-in'),
      ]),
      transition('closed => open', [
        animate('300ms ease-out'),
      ]),
    ]),
  ],
  template: `
    <div [@openClose]="isOpen() ? 'open' : 'closed'">
      Contenu
    </div>
  `,
})
export class ToggleComponent {
  protected readonly isOpen = signal(true);
}
```

### Transitions enter/leave legacy

```typescript
trigger('fadeInOut', [
  transition(':enter', [
    style({ opacity: 0 }),
    animate('200ms ease-in', style({ opacity: 1 })),
  ]),
  transition(':leave', [
    animate('200ms ease-out', style({ opacity: 0 })),
  ]),
])
```

### Pourquoi migrer vers CSS natif

| Legacy DSL | CSS natif |
|-----------|-----------|
| Bundle supplementaire (`@angular/animations`) | Zero bundle additionnel |
| API complexe (trigger, state, transition) | CSS standard |
| Performance JavaScript | Performance GPU (CSS animations) |
| Debugging difficile | DevTools CSS standard |
| Deprecie | Recommande officiellement |

## Regles

- **JAMAIS** mixer animations legacy et CSS natives dans le meme composant
- Preferer `transition` CSS pour les changements d'etat simples (hover, active, open/close)
- Preferer `animation` CSS + `animate.enter`/`animate.leave` pour les entrees/sorties du DOM
- Toujours appeler `animationComplete()` dans les callbacks d'animation
- Utiliser `will-change` avec parcimonie pour les animations frequentes
