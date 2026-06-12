# Responsive Design CSS — Reference

## Media queries
```css
/* Breakpoints courants (mobile-first) */
@media (min-width: 640px)  { /* sm — tablette portrait */ }
@media (min-width: 768px)  { /* md — tablette paysage */ }
@media (min-width: 1024px) { /* lg — desktop */ }
@media (min-width: 1280px) { /* xl — grand desktop */ }
@media (min-width: 1536px) { /* 2xl — tres grand */ }

/* Syntaxe moderne (range) */
@media (width >= 768px) { }
@media (768px <= width <= 1024px) { }
@media (width < 768px) { }

/* Orientation */
@media (orientation: portrait) { }
@media (orientation: landscape) { }

/* Preferences utilisateur */
@media (prefers-color-scheme: dark) { }
@media (prefers-reduced-motion: reduce) { }
@media (prefers-contrast: more) { }
@media (hover: hover) { }          /* souris disponible */
@media (pointer: coarse) { }      /* ecran tactile */
@media print { }                   /* impression */
```

## Container queries
```css
.container {
  container-type: inline-size;
  container-name: card;
}

@container card (width >= 400px) {
  .content { display: flex; }
}

/* Raccourci */
.container { container: card / inline-size; }
```

## Unites responsive
```css
/* Viewport */
100vw   /* largeur du viewport */
100vh   /* hauteur du viewport */
100dvh  /* hauteur dynamique (recommande mobile) */
100svh  /* small viewport height */
100lvh  /* large viewport height */

/* Clamp (taille fluide) */
font-size: clamp(1rem, 2.5vw, 2rem);
width: clamp(300px, 50%, 800px);
padding: clamp(1rem, 3vw, 3rem);

/* min/max */
width: min(100%, 1200px);   /* = max-width: 1200px */
width: max(300px, 50%);
```

## Images responsives CSS
```css
img {
  max-width: 100%;
  height: auto;
  display: block;
}

/* Object-fit (comme background-size pour les elements) */
img {
  width: 100%;
  height: 300px;
  object-fit: cover;        /* cover | contain | fill | none | scale-down */
  object-position: center;
}
```
