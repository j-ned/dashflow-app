# Typographie CSS — Reference

## Proprietes de police
```css
font-family: 'Inter', system-ui, -apple-system, sans-serif;
font-size: 1rem;              /* 16px par defaut */
font-weight: 400;             /* 100-900, normal=400, bold=700 */
font-style: italic;
font-variant: small-caps;
font-display: swap;           /* @font-face : afficher le fallback puis swap */
```

## Tailles (unites)
```css
/* Relatives (recommande) */
1rem      /* relatif a la taille root (16px par defaut) */
1em       /* relatif a la taille du parent */
1ch       /* largeur du caractere "0" */
1ex       /* hauteur du "x" */

/* Absolues (eviter sauf cas precis) */
16px
12pt

/* Viewport */
1vw       /* 1% de la largeur du viewport */
1vh       /* 1% de la hauteur du viewport */
1dvh      /* dynamic viewport height (mobile) */
1svh      /* small viewport height */
1lvh      /* large viewport height */

/* Responsive (clamp) */
font-size: clamp(1rem, 2.5vw, 2rem);
/* min: 1rem, prefere: 2.5vw, max: 2rem */
```

## Texte
```css
color: #333;
text-align: left | center | right | justify;
text-decoration: underline | line-through | none;
text-transform: uppercase | lowercase | capitalize | none;
text-indent: 2rem;
text-overflow: ellipsis;       /* tronquer avec ... */
text-wrap: balance;            /* equilibrer les lignes (titres) */
text-wrap: pretty;             /* eviter les orphelins */
white-space: nowrap;           /* pas de retour a la ligne */
word-break: break-word;        /* couper les mots longs */
overflow-wrap: break-word;     /* couper si deborde */
hyphens: auto;                 /* tirets de cesure */
letter-spacing: 0.05em;
line-height: 1.5;              /* 1.5 = 150% de la taille de police */
```

## Tronquer le texte
```css
/* Une ligne */
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Plusieurs lignes */
.line-clamp-3 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}
```

## @font-face (polices custom)
```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter.woff2') format('woff2');
  font-weight: 100 900;      /* variable font */
  font-style: normal;
  font-display: swap;
}
```

## System font stack
```css
font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
```
