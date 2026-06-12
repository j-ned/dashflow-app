# PrimeFlex — Utilitaires CSS

> Companion de PrimeNG. Alternative légère à Tailwind pour les projets PrimeNG.  
> Version 3.x (PrimeNG v17-) / 4.x (PrimeNG v18+).

## Installation

```bash
pnpm add primeflex
```

```scss
// styles.scss
@import 'primeflex/primeflex.css';
```

## Breakpoints

Préfixes responsives : `sm:` `md:` `lg:` `xl:`

| Préfixe | Breakpoint |
|---------|------------|
| `sm:` | ≥ 576px |
| `md:` | ≥ 768px |
| `lg:` | ≥ 992px |
| `xl:` | ≥ 1200px |

```html
<div class="hidden md:block">Visible à partir de md</div>
<div class="col-12 md:col-6 lg:col-4">Colonne responsive</div>
<div class="flex-column md:flex-row">Stack vertical sur mobile</div>
```

Pseudo-states : `hover:` `focus:` `active:`

```html
<div class="shadow-2 hover:shadow-8 transition-all transition-duration-300">...</div>
```

---

## Display

| Classe | CSS |
|--------|-----|
| `hidden` | `display: none` |
| `block` | `display: block` |
| `inline` | `display: inline` |
| `inline-block` | `display: inline-block` |
| `flex` | `display: flex` |
| `inline-flex` | `display: inline-flex` |

---

## Flexbox

### Direction

| Classe | CSS |
|--------|-----|
| `flex-row` | `flex-direction: row` |
| `flex-row-reverse` | `flex-direction: row-reverse` |
| `flex-column` | `flex-direction: column` |
| `flex-column-reverse` | `flex-direction: column-reverse` |

### Wrap

| Classe | CSS |
|--------|-----|
| `flex-wrap` | `flex-wrap: wrap` |
| `flex-nowrap` | `flex-wrap: nowrap` |
| `flex-wrap-reverse` | `flex-wrap: wrap-reverse` |

### Grow / Shrink / Shorthand

| Classe | CSS |
|--------|-----|
| `flex-1` | `flex: 1 1 0%` |
| `flex-auto` | `flex: 1 1 auto` |
| `flex-none` | `flex: none` |
| `flex-grow-0` / `flex-grow-1` | `flex-grow: 0/1` |
| `flex-shrink-0` / `flex-shrink-1` | `flex-shrink: 0/1` |

### Gap

Échelle : 0=0, 1=0.25rem, 2=0.5rem, 3=1rem, 4=1.5rem, 5=2rem, 6=3rem, 7=4rem, 8=5rem

| Classe | Portée |
|--------|--------|
| `gap-{0-8}` | Les deux axes |
| `row-gap-{0-8}` | Axe vertical |
| `column-gap-{0-8}` | Axe horizontal |

### Justify Content

| Classe | CSS |
|--------|-----|
| `justify-content-start` | `flex-start` |
| `justify-content-end` | `flex-end` |
| `justify-content-center` | `center` |
| `justify-content-between` | `space-between` |
| `justify-content-around` | `space-around` |
| `justify-content-evenly` | `space-evenly` |

### Align Items

| Classe | CSS |
|--------|-----|
| `align-items-stretch` | `stretch` |
| `align-items-start` | `flex-start` |
| `align-items-center` | `center` |
| `align-items-end` | `flex-end` |
| `align-items-baseline` | `baseline` |

### Align Self (enfants)

Mêmes suffixes que `align-items` avec préfixe `align-self-`.

### Layouts fréquents

```html
<!-- Barre de navigation -->
<nav class="flex align-items-center justify-content-between px-4 py-3 surface-card shadow-1">
  <span class="font-bold text-primary">Logo</span>
  <div class="flex gap-3 hidden md:flex">Nav links</div>
  <p-button label="CTA" />
</nav>

<!-- Card avec layout flex -->
<div class="flex flex-column md:flex-row gap-4 align-items-center surface-card border-round p-4 shadow-2">
  <img class="w-8rem border-circle" src="avatar.jpg" alt="User" />
  <div class="flex flex-column gap-2 flex-1">
    <h3 class="text-xl font-bold m-0">Nom Prénom</h3>
    <p class="text-color-secondary m-0">Description</p>
  </div>
  <p-button label="Contacter" />
</div>
```

---

## Grid System (12 colonnes)

| Classe | CSS |
|--------|-----|
| `grid` | `display: flex; flex-wrap: wrap; margin: -0.5rem` |
| `grid-nogutter` | Retire les marges négatives |
| `col` | `flex: 1` (largeur auto égale) |
| `col-fixed` | `flex: 0 0 auto` (taille contenu) |
| `col-1` … `col-12` | 8.33% … 100% |

```html
<!-- Colonnes égales -->
<div class="grid">
  <div class="col"><div class="p-3 surface-card">1/3</div></div>
  <div class="col"><div class="p-3 surface-card">1/3</div></div>
  <div class="col"><div class="p-3 surface-card">1/3</div></div>
</div>

<!-- Responsive -->
<div class="grid">
  <div class="col-12 md:col-6 lg:col-4">Carte 1</div>
  <div class="col-12 md:col-6 lg:col-4">Carte 2</div>
  <div class="col-12 md:col-12 lg:col-4">Carte 3</div>
</div>

<!-- Sans gouttière -->
<div class="grid grid-nogutter">
  <div class="col-8">Principal</div>
  <div class="col-4">Sidebar</div>
</div>
```

---

## Spacing

Échelle de référence :

| Étape | Valeur |
|-------|--------|
| 0 | 0 |
| 1 | 0.25rem |
| 2 | 0.5rem |
| 3 | 1rem |
| 4 | 1.5rem |
| 5 | 2rem |
| 6 | 3rem |
| 7 | 4rem |
| 8 | 5rem |

### Padding : `p{côté}-{0-8}`

| Préfixe | Côté |
|---------|------|
| `p-` | Tous |
| `pt-` `pb-` `pl-` `pr-` | Top / Bottom / Left / Right |
| `px-` | Left + Right |
| `py-` | Top + Bottom |

### Margin : `m{côté}-{0-8}` + helpers auto

| Classe | CSS |
|--------|-----|
| `mx-auto` | Centrage horizontal |
| `my-auto` | Centrage vertical |
| `m-auto` | Centrage total |
| `mt-auto` `mb-auto` `ml-auto` `mr-auto` | Auto par côté |

```html
<div class="p-4 mx-auto mt-5">Container centré avec padding</div>
<div class="px-4 py-2 mb-3">Padding horizontal + vertical + marge bas</div>
<div class="surface-card p-3 md:p-5">Padding responsive</div>
```

---

## Typographie

### Font Size

| Classe | Taille |
|--------|--------|
| `text-xs` | 0.75rem |
| `text-sm` | 0.875rem |
| `text-base` | 1rem |
| `text-lg` | 1.125rem |
| `text-xl` | 1.25rem |
| `text-2xl` | 1.5rem |
| `text-3xl` | 1.75rem |
| `text-4xl` | 2rem |
| `text-5xl` | 2.5rem |
| `text-6xl` | 3rem |

### Font Weight

`font-light` (300) `font-normal` (400) `font-medium` (500) `font-semibold` (600) `font-bold` (700)

### Text Align

`text-left` `text-center` `text-right` `text-justify`

### Text Transform

`uppercase` `lowercase` `capitalize`

### Overflow / Ellipsis

```html
<div class="white-space-nowrap overflow-hidden text-overflow-ellipsis w-10rem">
  Texte très long tronqué...
</div>
```

### Line Height

`line-height-1` (1) `line-height-2` (1.25) `line-height-3` (1.5) `line-height-4` (2)

---

## Couleurs

### Couleurs sémantiques (tokens PrimeNG)

| Classe | Cible |
|--------|-------|
| `text-primary` / `bg-primary` | Couleur primaire du thème |
| `text-color` / `text-color-secondary` | Couleurs texte du thème |
| `surface-ground` | Fond de page |
| `surface-card` | Fond des cards |
| `surface-overlay` | Fond des overlays |
| `surface-border` | Couleur de bordure |
| `surface-hover` | Hover state |

### Palette statique

Couleurs : `blue` `green` `red` `yellow` `purple` `pink` `orange` `teal` `cyan` `indigo`  
Nuances : `50` `100` … `900`

```html
<span class="text-blue-500">Texte bleu</span>
<div class="bg-green-100 text-green-700 border-round px-3 py-1">Badge vert</div>
<div class="bg-red-500 text-white p-3 border-round">Alerte rouge</div>
```

---

## Élévation (Shadow)

| Classe | Effet |
|--------|-------|
| `shadow-none` | Aucune ombre |
| `shadow-1` | Très légère |
| `shadow-2` | Card légère |
| `shadow-3` | Card élevée |
| `shadow-4` | Élément flottant |
| `shadow-5` | Dropdown |
| `shadow-6` | Dialog |
| `shadow-7` / `shadow-8` | Profondeur maximale |

```html
<div class="shadow-2 hover:shadow-6 transition-shadow transition-duration-300 border-round p-4">
  Survol pour profondeur
</div>
```

---

## Bordures

### Largeur

`border-none` `border-1` `border-2` `border-3`  
Variantes par côté : `border-top-1`, `border-bottom-2`, `border-x-1`, `border-y-2`

### Style (obligatoire pour afficher la bordure)

`border-solid` `border-dashed` `border-dotted`

### Couleur

`border-primary` `border-transparent` `surface-border` `border-blue-500` …

```html
<!-- Bordure complète -->
<div class="border-1 border-solid surface-border border-round p-3">Box</div>

<!-- Séparateur bas -->
<div class="border-bottom-1 border-solid surface-border pb-3 mb-3">Section</div>

<!-- Bordure primaire au focus -->
<div class="border-1 border-solid border-primary border-round p-3">Focus</div>
```

---

## Border Radius

| Classe | Valeur |
|--------|--------|
| `border-noround` | 0 |
| `border-round-xs` | 0.125rem |
| `border-round-sm` | 0.25rem |
| `border-round` | `var(--border-radius)` |
| `border-round-md` | 0.375rem |
| `border-round-lg` | 0.5rem |
| `border-round-xl` | 0.75rem |
| `border-round-2xl` | 1rem |
| `border-round-3xl` | 1.5rem |
| `border-circle` | 50% |

Variantes par côté : `border-round-top-sm`, `border-round-left-lg`, `border-circle-right`

```html
<!-- Card standard -->
<div class="border-round shadow-2 p-4">Card</div>

<!-- Avatar circulaire -->
<img class="border-circle w-4rem h-4rem" src="avatar.jpg" alt="User" />

<!-- Pill -->
<span class="border-round-3xl px-3 py-1 bg-blue-100 text-blue-700">Tag</span>
```

---

## Patterns de layout courants

```html
<!-- Card article -->
<div class="surface-card border-round shadow-2 p-4 mb-3">
  <h2 class="text-xl font-bold text-900 mt-0 mb-2">Titre</h2>
  <p class="text-color-secondary text-sm line-height-3 m-0">Contenu</p>
  <div class="flex align-items-center gap-2 mt-3">
    <p-tag value="Angular" severity="info" />
    <p-tag value="TypeScript" severity="secondary" />
  </div>
</div>

<!-- Formulaire field -->
<div class="flex flex-column gap-2 mb-4">
  <label class="font-medium text-900" for="name">Nom</label>
  <input pInputText id="name" formControlName="name" class="w-full" />
  @if (isInvalid('name')) {
    <p-message severity="error" text="Le nom est requis." />
  }
</div>

<!-- Grille de cards responsive -->
<div class="grid mt-4">
  @for (item of items(); track item.id) {
    <div class="col-12 sm:col-6 lg:col-4 xl:col-3">
      <div class="surface-card border-round shadow-1 p-3 h-full">
        <!-- contenu card -->
      </div>
    </div>
  }
</div>

<!-- Header sticky -->
<header class="flex align-items-center justify-content-between px-4 py-3
               surface-card border-bottom-1 border-solid surface-border
               sticky top-0 z-1">
  <span class="font-bold text-xl text-primary">App</span>
  <nav class="flex gap-3 hidden md:flex">...</nav>
  <p-button label="Connexion" size="small" />
</header>
```

---

## Différences clés avec Tailwind v4

| Aspect | PrimeFlex | Tailwind v4 |
|--------|-----------|-------------|
| Espacement 3 | `1rem` | `0.75rem` |
| Arrondi | `border-round` | `rounded` |
| Flex column | `flex-column` | `flex-col` |
| Couleurs primaires | Tokens thème (`text-primary`) | Classes utilitaires |
| Séparateur responsive | `md:block` | `md:block` (identique) |
| Align items | `align-items-center` | `items-center` |
| Justify content | `justify-content-between` | `justify-between` |
