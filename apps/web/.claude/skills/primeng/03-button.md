# PrimeNG — Button

**Import** : `import { ButtonModule } from 'primeng/button';`  
**Sélecteur** : `p-button` (composant) ou `[pButton]` (directive sur `<button>`)

## Inputs clés

| Prop | Type | Défaut | Notes |
|------|------|--------|-------|
| `label` | `string` | — | Texte |
| `icon` | `string` | — | Classe icône (`pi pi-check`) |
| `iconPos` | `'left'\|'right'\|'top'\|'bottom'` | `'left'` | Position icône |
| `severity` | `'primary'\|'secondary'\|'success'\|'info'\|'warn'\|'help'\|'danger'\|'contrast'` | — | Style sémantique |
| `variant` | `'outlined'\|'text'` | — | Variante visuelle |
| `size` | `'small'\|'large'` | — | Taille |
| `raised` | `boolean` | `false` | Ombre |
| `rounded` | `boolean` | `false` | Border-radius circulaire |
| `loading` | `boolean` | `false` | Spinner de chargement |
| `loadingIcon` | `string` | — | Icône custom en loading |
| `disabled` | `boolean` | — | |
| `type` | `string` | `'button'` | Type HTML (`'submit'`, `'reset'`) |
| `badge` | `string` | — | Texte du badge superposé |
| `badgeSeverity` | severity union | `'secondary'` | |
| `link` | `boolean` | `false` | Style lien |
| `fluid` | `boolean` | — | Pleine largeur |
| `ariaLabel` | `string` | — | **Obligatoire si icon-only** |

## Outputs

| Event | Type |
|-------|------|
| `onClick` | `MouseEvent` |
| `onFocus` | `FocusEvent` |
| `onBlur` | `FocusEvent` |

## Exemples

```html
<!-- Basique -->
<p-button label="Enregistrer" />

<!-- Severities -->
<p-button label="Succès"   severity="success" />
<p-button label="Danger"   severity="danger" />
<p-button label="Avertis." severity="warn" />
<p-button label="Info"     severity="info" />

<!-- Variantes -->
<p-button label="Outlined" severity="secondary" variant="outlined" />
<p-button label="Texte"    severity="danger"    variant="text" />

<!-- Avec icône -->
<p-button label="Sauvegarder" icon="pi pi-check" />
<p-button label="Supprimer"   icon="pi pi-trash" iconPos="right" severity="danger" />

<!-- Icon-only — aria-label obligatoire -->
<p-button icon="pi pi-home" aria-label="Accueil" variant="text" [rounded]="true" />

<!-- Loading (signal-based) -->
<p-button label="Rechercher" icon="pi pi-search" [loading]="isSearching()" (onClick)="search()" />

<!-- Styles avancés -->
<p-button label="Raised"  [raised]="true"  severity="success" />
<p-button label="Rounded" [rounded]="true" severity="info" />

<!-- Tailles -->
<p-button label="Small" size="small" />
<p-button label="Large" size="large" />

<!-- Fluid (pleine largeur) -->
<p-button label="Pleine largeur" [fluid]="true" />

<!-- Type submit -->
<p-button label="Valider" type="submit" [disabled]="form.invalid" />
```

## ButtonGroup

**Import** : `import { ButtonGroupModule } from 'primeng/buttongroup';`

```html
<p-buttongroup>
  <p-button label="Enregistrer" icon="pi pi-check" />
  <p-button label="Éditer"      icon="pi pi-pencil" severity="secondary" />
  <p-button label="Supprimer"   icon="pi pi-trash"  severity="danger" />
</p-buttongroup>
```

## Directive pButton (sur bouton natif)

```html
<button pButton type="button" label="Click" icon="pi pi-check" class="p-button-success"></button>
```

## Gotchas

- Icon-only : **toujours** `aria-label` — sinon les lecteurs d'écran ne savent pas ce que fait le bouton.
- `loading` désactive automatiquement le bouton — pas besoin de `[disabled]="true"` en parallèle.
- `type` vaut `'button'` par défaut, pas `'submit'` — toujours expliciter dans les formulaires.
- `onClick` (camelCase) et non `click` — l'event natif `click` fonctionne aussi mais PrimeNG expose `onClick`.
