# Styles Custom Tailwind v4 — Reference

## @layer base — styles par defaut
```css
@layer base {
  h1 { font-size: var(--text-2xl); font-weight: var(--font-weight-bold); }
  h2 { font-size: var(--text-xl); }
  a { color: var(--color-blue-500); text-decoration: underline; }
}
```

## @layer components — classes reutilisables
```css
@layer components {
  .card {
    background: var(--color-white);
    border-radius: var(--radius-lg);
    padding: --spacing(6);
    box-shadow: var(--shadow-xl);
  }
  .btn-primary {
    background: var(--color-blue-500);
    color: white;
    padding: --spacing(2) --spacing(4);
    border-radius: var(--radius-md);
  }
}
```
Les utilitaires peuvent overrider : `<div class="card rounded-none">`

## @utility — utilitaires custom
```css
/* Simple */
@utility content-auto {
  content-visibility: auto;
}

/* Avec pseudo-element */
@utility scrollbar-hidden {
  &::-webkit-scrollbar { display: none; }
}
```
Utilisable avec les variants : hover:content-auto, dark:scrollbar-hidden

## @utility fonctionnel (avec parametres)
```css
@theme {
  --tab-size-2: 2;
  --tab-size-4: 4;
}

@utility tab-* {
  tab-size: --value(--tab-size-*, integer, [integer]);
}
/* → tab-2, tab-4, tab-[8] */
```

## @custom-variant — variant custom
```css
@custom-variant theme-midnight (&:where([data-theme="midnight"] *));
/* → theme-midnight:bg-black, theme-midnight:text-white */

/* Avec @media */
@custom-variant any-hover {
  @media (any-hover: hover) {
    &:hover { @slot; }
  }
}
```

## @variant — appliquer un variant dans le CSS
```css
.my-element {
  background: white;
  @variant dark { background: black; }
  @variant hover { background: gray; }
}
```

## @apply — inliner les utilitaires (eviter si possible)
```css
.select2-dropdown {
  @apply rounded-b-lg shadow-md;
}
```
Usage recommande : overrider des librairies tierces uniquement.

## @reference — utiliser le theme dans les composants (Vue, Svelte)
```vue
<style>
  @reference "tailwindcss";
  h1 { @apply text-2xl font-bold text-red-500; }
</style>
```

## Valeurs arbitraires
```html
<div class="top-[117px]">              <!-- valeur custom -->
<div class="bg-[#bada55]">             <!-- couleur custom -->
<div class="grid-cols-[1fr_500px_2fr]"><!-- grid custom (underscore = espace) -->
<div class="fill-(--my-brand-color)">  <!-- variable CSS -->
```

## Proprietes arbitraires
```html
<div class="[mask-type:luminance]">
<div class="[--scroll-offset:56px]">
```

## Fonctions utilitaires
```css
/* --alpha() — ajuster l'opacite */
color: --alpha(var(--color-blue-500) / 50%);

/* --spacing() — calculer l'espacement */
margin: --spacing(4);  /* = calc(var(--spacing) * 4) */
```

## @source — scanner des fichiers supplementaires
```css
@source "../node_modules/@my-company/ui-lib";
```
