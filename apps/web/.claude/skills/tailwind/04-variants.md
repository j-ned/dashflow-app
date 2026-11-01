# Variants Tailwind v4 — Reference

## Etats interactifs
```html
hover:bg-blue-600       /* survol */
focus:outline-2         /* focus */
focus-visible:ring-2    /* focus clavier */
focus-within:border-blue-500  /* enfant focus */
active:bg-blue-700      /* clic */
visited:text-purple-600 /* lien visite */
```

## Etats de formulaire
```html
disabled:opacity-50     /* desactive */
required:border-red-500 /* requis */
invalid:border-red-500  /* invalide */
valid:border-green-500  /* valide */
checked:bg-blue-500     /* coche */
indeterminate:bg-gray-300
placeholder:text-gray-400
autofill:bg-yellow-100
read-only:bg-gray-100
```

## Pseudo-classes structurelles
```html
first:pt-0 last:pb-0           /* premier/dernier */
odd:bg-white even:bg-gray-50   /* pair/impair */
only:block                      /* enfant unique */
empty:hidden                    /* element vide */
first-of-type:font-bold
nth-3:underline                 /* 3eme enfant */
```

## Pseudo-elements
```html
before:content-['*'] before:text-red-500
after:content-[''] after:block
placeholder:text-gray-400
selection:bg-pink-300
marker:text-sky-400    /* puces de liste */
file:bg-violet-50 file:text-violet-700  /* input file */
first-letter:text-7xl first-letter:font-bold
first-line:uppercase
backdrop:bg-gray-50/80  /* dialog backdrop */
```

## Group (parent → enfant)
```html
<a class="group">
  <h3 class="group-hover:text-white">Titre</h3>
  <p class="group-hover:text-gray-200">Description</p>
</a>

<!-- Group nomme (imbrique) -->
<div class="group/item">
  <a class="group/edit">
    <span class="group-hover/edit:text-blue-500">Edit</span>
  </a>
</div>
```

## Peer (sibling → sibling)
```html
<input class="peer" type="email" />
<p class="invisible peer-invalid:visible text-red-500">Email invalide</p>

<!-- Peer nomme -->
<input class="peer/draft" type="radio" />
<label class="peer-checked/draft:text-sky-500">Draft</label>
```

## In (parent implicite)
```html
<div tabindex="0">
  <div class="opacity-50 in-focus:opacity-100">Contenu</div>
</div>
```

## has: (style selon les descendants)
```html
<label class="has-checked:bg-indigo-50">
  <input type="radio" class="checked:border-indigo-500" />
  Option
</label>
```

## not: (negation)
```html
<button class="hover:not-focus:bg-indigo-700">
```

## Dark mode
```html
<div class="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
```

## Responsive
```html
sm: md: lg: xl: 2xl:
max-sm: max-md: max-lg:
```

## Print
```html
<div class="print:hidden">Non imprime</div>
```

## Motion
```html
motion-reduce:hidden    /* animations reduites */
motion-safe:transition  /* animations OK */
```

## Contraste
```html
contrast-more:border-gray-400
contrast-less:opacity-50
```

## RTL / LTR
```html
ltr:ml-3 rtl:mr-3
```

## Open (details, popover)
```html
<details class="open:bg-gray-100">
```

## ARIA
```html
aria-checked:bg-sky-700
aria-expanded:rotate-180
aria-[sort=ascending]:bg-blue-100
```

## Data attributes
```html
data-active:border-purple-500
data-[size=large]:p-8
```

## Stacking (combiner les variants)
```html
dark:md:hover:bg-fuchsia-600
```

## Enfants (* et **)
```html
<!-- Enfants directs -->
<ul class="*:rounded-full *:border *:px-2">
<!-- Tous les descendants -->
<ul class="**:data-avatar:rounded-full">
```

## Custom variant
```css
@custom-variant theme-midnight (&:where([data-theme="midnight"] *));
```

## Arbitrary variant
```html
<li class="[&.is-dragging]:cursor-grabbing">
<div class="[@supports(display:grid)]:grid">
```
