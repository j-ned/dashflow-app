# Variables et Fonctions CSS — Reference

## Custom Properties (variables CSS)
```css
:root {
  --color-primary: #3b82f6;
  --color-text: #1f2937;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 2rem;
  --radius: 0.5rem;
  --shadow: 0 4px 6px rgb(0 0 0 / 0.1);
  --font-sans: 'Inter', system-ui, sans-serif;
}

.card {
  color: var(--color-text);
  padding: var(--spacing-md);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

/* Fallback */
color: var(--color-primary, blue);
```

## Dark mode avec variables
```css
:root {
  --bg: white;
  --text: #1f2937;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #111827;
    --text: #f3f4f6;
  }
}

body {
  background: var(--bg);
  color: var(--text);
}
```

## Fonctions CSS
```css
/* Calcul */
width: calc(100% - 2rem);
padding: calc(var(--spacing) * 2);
margin: calc(50% - 200px);

/* Taille responsive */
font-size: clamp(1rem, 2.5vw, 2rem);     /* min, prefere, max */
width: min(100%, 1200px);                  /* le plus petit */
width: max(300px, 50%);                    /* le plus grand */

/* Couleur */
color: color-mix(in oklch, blue 70%, white);
color: oklch(from var(--primary) l c h / 50%);    /* relative color syntax */
color: light-dark(#333, #eee);                     /* auto dark mode */

/* Filtres */
filter: blur(4px);
filter: brightness(1.2);
filter: contrast(1.5);
filter: grayscale(100%);
filter: saturate(1.5);
filter: sepia(100%);
filter: hue-rotate(90deg);
filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));
filter: invert(100%);
backdrop-filter: blur(10px);                       /* flou d'arriere-plan */

/* Shapes */
clip-path: circle(50%);
clip-path: polygon(50% 0%, 0% 100%, 100% 100%);   /* triangle */
clip-path: inset(10px 20px 30px 40px round 8px);

/* Formes pour le texte */
shape-outside: circle(50%);
```

## @layer (couches de cascade)
```css
@layer reset, base, components, utilities;

@layer reset {
  * { margin: 0; padding: 0; box-sizing: border-box; }
}

@layer base {
  body { font-family: var(--font-sans); }
}

@layer components {
  .card { /* ... */ }
}
/* Les utilitaires (derniere couche) ont la priorite la plus haute */
```

## @scope (CSS moderne)
```css
@scope (.card) to (.card-content) {
  p { color: gray; }  /* s'applique entre .card et .card-content */
}
```

## @property (variables typees)
```css
@property --progress {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 0%;
}
/* Permet d'animer les variables CSS */
```

## has: (parent selector — CSS4)
```css
/* Styler un label quand son input est focus */
label:has(input:focus) {
  color: blue;
}

/* Styler un formulaire qui contient un champ invalide */
form:has(:invalid) {
  border-color: red;
}

/* Styler un element si son frere suivant existe */
h2:has(+ p) {
  margin-bottom: 0.5rem;
}
```
