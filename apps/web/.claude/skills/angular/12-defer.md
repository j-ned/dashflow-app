# @defer Angular — Reference complete (v17+)

## Syntaxe de base

```html
@defer {
  <heavy-component />
}
```

Le contenu du bloc `@defer` est **lazy-loaded** : le bundle JavaScript du composant n'est telecharge que quand le trigger est declenche.

## Syntaxe complete

```html
@defer (on viewport; prefetch on idle) {
  <heavy-component />
} @placeholder (minimum 500ms) {
  <p>Contenu par defaut visible avant le chargement</p>
} @loading (after 100ms; minimum 1s) {
  <app-spinner />
} @error {
  <p>Erreur lors du chargement du composant</p>
}
```

## Triggers

### on idle (defaut)

```html
@defer (on idle) {
  <widget />
}
```

- Se declenche quand le navigateur est **idle** (via `requestIdleCallback`)
- Trigger par defaut si aucun trigger n'est specifie
- Ideal pour le contenu non critique "below the fold"

### on viewport

```html
@defer (on viewport) {
  <heavy-chart />
}
```

- Se declenche quand le `@placeholder` (ou l'element de reference) entre dans le **viewport**
- Utilise `IntersectionObserver` en interne

#### Reference a un element specifique

```html
<div #chartArea>Zone du graphique</div>

@defer (on viewport(chartArea)) {
  <heavy-chart />
} @placeholder {
  <p>Le graphique se chargera quand vous scrollerez ici</p>
}
```

- Par defaut, observe le `@placeholder`
- Avec `on viewport(ref)`, observe l'element reference

### on interaction

```html
@defer (on interaction) {
  <comment-editor />
} @placeholder {
  <button>Ecrire un commentaire</button>
}
```

- Se declenche au **click** ou **keydown** sur le `@placeholder`
- Reference specifique : `on interaction(triggerRef)`

```html
<button #editBtn>Modifier</button>

@defer (on interaction(editBtn)) {
  <inline-editor />
}
```

### on hover

```html
@defer (on hover) {
  <tooltip-content />
} @placeholder {
  <span>Survolez pour plus d'infos</span>
}
```

- Se declenche au **mouseover** ou **focusin** sur le `@placeholder`
- Reference specifique : `on hover(triggerRef)`

### on immediate

```html
@defer (on immediate) {
  <analytics-widget />
}
```

- Se declenche **immediatement** apres le rendu initial
- Le chargement est differe mais demarre tout de suite
- Utile pour separer le bundle sans retarder le chargement

### on timer

```html
@defer (on timer(2s)) {
  <promotional-banner />
}
```

- Se declenche apres le **delai specifie**
- Accepte : `500ms`, `2s`, `1.5s`

### when (condition)

```html
@defer (when isAdminUser()) {
  <admin-panel />
}
```

- Se declenche quand la condition devient **truthy**
- **One-time** : une fois declenche, ne se re-declenche pas si la condition redevient falsy
- Peut etre combine avec d'autres triggers

## Combinaison de triggers (OR)

Plusieurs triggers separes par `;` agissent comme un **OR** logique :

```html
@defer (on viewport; on timer(5s)) {
  <heavy-component />
}
```

Le composant se charge si l'element entre dans le viewport **OU** apres 5 secondes.

```html
@defer (on interaction; on hover; when shouldLoad()) {
  <feature />
} @placeholder {
  <button>Charger la feature</button>
}
```

## Prefetch

Le prefetch telecharge les ressources (bundle JS) **avant** le trigger d'affichage :

```html
@defer (on interaction; prefetch on idle) {
  <dashboard-widget />
} @placeholder {
  <button>Ouvrir le dashboard</button>
}
```

- Les ressources sont pre-chargees quand le navigateur est idle
- L'affichage se fait au click
- Resultat : affichage quasi-instantane au click

### Prefetch avec when

```html
@defer (on viewport; prefetch when isPremiumUser()) {
  <premium-content />
}
```

### Prefetch multiples

```html
@defer (on interaction; prefetch on idle; prefetch on hover) {
  <editor />
}
```

## Blocs optionnels

### @placeholder

```html
@placeholder {
  <p>Contenu affiche avant le chargement</p>
}

@placeholder (minimum 500ms) {
  <p>Visible pendant au moins 500ms (evite le flash)</p>
}
```

- Affiche avant que le trigger ne se declenche
- `minimum` — duree minimale d'affichage pour eviter le scintillement
- Le contenu du placeholder est **eager-loaded** (inclus dans le bundle principal)
- Sert de cible par defaut pour `on viewport`, `on interaction`, `on hover`

### @loading

```html
@loading {
  <app-spinner />
}

@loading (after 100ms; minimum 1s) {
  <app-spinner />
}
```

- Affiche **pendant** le chargement des ressources
- `after` — delai avant d'afficher le loading (evite le flash pour les chargements rapides)
- `minimum` — duree minimale d'affichage (evite le flash de spinner)
- Combine : `after 100ms; minimum 1s` = si le chargement prend plus de 100ms, afficher le spinner pendant au moins 1s

### @error

```html
@error {
  <div class="error-state">
    <p>Impossible de charger ce composant</p>
    <button (click)="retry()">Reessayer</button>
  </div>
}
```

- Affiche si le chargement echoue (erreur reseau, module introuvable, etc.)
- Le contenu est eager-loaded

## SSR / SSG

### Comportement par defaut

- Sur le **serveur** : le `@placeholder` est rendu (le contenu defer est ignore)
- Sur le **client** : le contenu est lazy-loaded normalement apres l'hydratation

### Forcer le rendu cote serveur

```html
@defer (hydrate on viewport) {
  <seo-content />
} @placeholder {
  <p>Placeholder SSR</p>
}
```

Triggers d'hydratation disponibles (Angular v19+) :
- `hydrate on idle`
- `hydrate on viewport`
- `hydrate on interaction`
- `hydrate on hover`
- `hydrate on timer(ns)`
- `hydrate when condition`
- `hydrate never` — rendu sur le serveur, jamais hydrate (contenu statique)

## Testing

### DeferBlockBehavior.Manual

Par defaut en test, les blocs `@defer` sont rendus immediatement (mode `Playthrough`). Pour tester les differents etats :

```typescript
import { DeferBlockBehavior, DeferBlockState } from '@angular/core/testing';

describe('ComponentWithDefer', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      deferBlockBehavior: DeferBlockBehavior.Manual,  // controle manuel
    });
  });

  it('should show placeholder initially', async () => {
    const fixture = TestBed.createComponent(MyComponent);
    fixture.detectChanges();

    // Verifier le placeholder
    expect(fixture.nativeElement.textContent).toContain('Placeholder');
  });

  it('should show loading state', async () => {
    const fixture = TestBed.createComponent(MyComponent);
    fixture.detectChanges();

    // Passer a l'etat loading
    const deferBlock = (await fixture.getDeferBlocks())[0];
    await deferBlock.render(DeferBlockState.Loading);

    expect(fixture.nativeElement.textContent).toContain('Chargement');
  });

  it('should show content when resolved', async () => {
    const fixture = TestBed.createComponent(MyComponent);
    fixture.detectChanges();

    // Passer a l'etat complete
    const deferBlock = (await fixture.getDeferBlocks())[0];
    await deferBlock.render(DeferBlockState.Complete);

    expect(fixture.nativeElement.textContent).toContain('Contenu charge');
  });

  it('should show error state', async () => {
    const fixture = TestBed.createComponent(MyComponent);
    fixture.detectChanges();

    const deferBlock = (await fixture.getDeferBlocks())[0];
    await deferBlock.render(DeferBlockState.Error);

    expect(fixture.nativeElement.textContent).toContain('Erreur');
  });
});
```

### DeferBlockState

| State | Description |
|-------|-------------|
| `Placeholder` | Etat initial, affiche le @placeholder |
| `Loading` | En cours de chargement, affiche @loading |
| `Complete` | Charge avec succes, affiche le contenu |
| `Error` | Echec du chargement, affiche @error |

## Accessibilite

### aria-live pour les changements dynamiques

```html
@defer (on interaction) {
  <div aria-live="polite">
    <search-results />
  </div>
} @placeholder {
  <button aria-label="Charger les resultats de recherche">
    Afficher les resultats
  </button>
} @loading {
  <div role="status" aria-live="polite">
    <span>Chargement des resultats...</span>
  </div>
} @error {
  <div role="alert" aria-live="assertive">
    <p>Erreur lors du chargement des resultats</p>
  </div>
}
```

### Bonnes pratiques accessibilite

- Utiliser `role="status"` et `aria-live="polite"` pour les indicateurs de chargement
- Utiliser `role="alert"` et `aria-live="assertive"` pour les erreurs
- S'assurer que le `@placeholder` est interactif au clavier si le trigger est `on interaction`
- Fournir un texte alternatif dans le `@loading` pour les lecteurs d'ecran

## Bonnes pratiques

### Eviter les chargements en cascade

```html
<!-- MAUVAIS — cascade : A charge, puis B charge, puis C charge -->
@defer (on viewport) {
  <component-a />
  @defer (on idle) {
    <component-b />
    @defer (on idle) {
      <component-c />
    }
  }
}

<!-- BON — charger en parallele -->
@defer (on viewport) {
  <component-a />
}
@defer (on viewport) {
  <component-b />
}
@defer (on viewport) {
  <component-c />
}
```

### Prevenir les layout shifts (CLS)

```html
<!-- Donner des dimensions fixes au placeholder -->
@defer (on viewport) {
  <heavy-chart />
} @placeholder {
  <div style="height: 400px; width: 100%; background: #f0f0f0;">
    Le graphique se chargera ici
  </div>
}
```

- Le `@placeholder` doit avoir les **memes dimensions** que le contenu final
- Utiliser `minimum` sur `@placeholder` pour eviter le flash

### Ne pas defer le contenu above-the-fold

```html
<!-- MAUVAIS — le header est visible immediatement -->
@defer (on idle) {
  <app-header />
}

<!-- BON — defer seulement le contenu below-the-fold -->
<app-header />
<app-hero />

@defer (on viewport) {
  <app-testimonials />
}

@defer (on viewport) {
  <app-footer />
}
```

### Granularite

- Defer des **composants entiers**, pas des petits morceaux de template
- Plus le composant est lourd (dependances, sous-composants), plus le defer est benefique
- Les composants legers ne beneficient pas du defer (overhead du lazy loading)

### Prefetch pour l'UX

```html
<!-- Pattern recommande : prefetch en idle, afficher a l'interaction -->
@defer (on interaction; prefetch on idle) {
  <feature-component />
} @placeholder {
  <button>Activer la feature</button>
}
```

Cela garantit que le bundle est probablement deja telecharge quand l'utilisateur clique, donnant une impression de chargement instantane.
