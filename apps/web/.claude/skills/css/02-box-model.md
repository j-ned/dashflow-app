# Box Model CSS — Reference

## Box model
```
+------------------------------------------+
|              margin                       |
|  +--------------------------------------+|
|  |           border                     ||
|  |  +----------------------------------+||
|  |  |          padding                 |||
|  |  |  +------------------------------+|||
|  |  |  |         content              ||||
|  |  |  +------------------------------+|||
|  |  +----------------------------------+||
|  +--------------------------------------+|
+------------------------------------------+
```

## box-sizing (toujours utiliser border-box)
```css
*, *::before, *::after {
  box-sizing: border-box;
}
/* border-box : width/height incluent padding + border */
/* content-box (defaut) : width/height = contenu seulement */
```

## Margin
```css
margin: 16px;                    /* tous les cotes */
margin: 16px 24px;               /* vertical horizontal */
margin: 8px 16px 24px 32px;      /* top right bottom left */
margin-top: 16px;
margin-inline: auto;             /* centrer horizontalement */
margin-block: 16px;              /* vertical (logique) */

/* Margin collapse : les margins verticaux fusionnent */
/* Le plus grand gagne, sauf si : flex, grid, overflow, padding/border entre */
```

## Padding
```css
padding: 16px;
padding: 16px 24px;
padding-inline: 24px;           /* horizontal (logique) */
padding-block: 16px;            /* vertical (logique) */
```

## Proprietes logiques (recommande — supporte RTL)
```css
/* Au lieu de left/right/top/bottom : */
margin-inline-start: 16px;      /* = margin-left en LTR */
margin-inline-end: 16px;        /* = margin-right en LTR */
margin-block-start: 16px;       /* = margin-top */
margin-block-end: 16px;         /* = margin-bottom */
padding-inline: 24px;           /* = padding-left + padding-right */
padding-block: 16px;            /* = padding-top + padding-bottom */
inline-size: 100%;              /* = width */
block-size: auto;               /* = height */
border-inline-start: 1px solid; /* = border-left en LTR */
```

## Width / Height
```css
width: 100%;
max-width: 1200px;
min-width: 320px;
height: auto;
min-height: 100vh;
min-height: 100dvh;             /* dynamic viewport height (mobile) */
aspect-ratio: 16 / 9;
```

## Overflow
```css
overflow: visible;     /* depasse (defaut) */
overflow: hidden;      /* coupe */
overflow: scroll;      /* barre de defilement toujours */
overflow: auto;        /* barre si necessaire */
overflow-x: auto;     /* horizontal seulement */
overflow-y: scroll;    /* vertical seulement */
```

## Display
```css
display: block;        /* element bloc */
display: inline;       /* element en ligne */
display: inline-block; /* inline mais accepte width/height/margin */
display: none;         /* cache (retire du flux) */
display: contents;     /* supprime la boite, garde les enfants */
display: flex;         /* flexbox */
display: grid;         /* grid */
display: inline-flex;  /* flex en ligne */
display: inline-grid;  /* grid en ligne */
```
