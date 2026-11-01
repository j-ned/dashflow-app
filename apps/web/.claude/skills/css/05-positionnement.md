# Positionnement CSS — Reference

## position
```css
position: static;      /* defaut — dans le flux normal */
position: relative;    /* dans le flux + decalable (top/left/right/bottom) */
position: absolute;    /* hors du flux, relatif au parent positionne */
position: fixed;       /* hors du flux, relatif au viewport */
position: sticky;      /* dans le flux, puis colle au scroll */
```

## Sticky (header qui colle)
```css
.header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: white;
}
```

## z-index
```css
z-index: 1;     /* 1 — element au-dessus */
z-index: 10;    /* couches de base */
z-index: 100;   /* overlays, dropdowns */
z-index: 1000;  /* modales */
z-index: 10000; /* notifications, toasts */
/* Ne fonctionne que sur les elements positionnes (pas static) */
/* Ou sur les enfants de flex/grid */
```

## Centrer un element absolument positionne
```css
.centered {
  position: absolute;
  top: 50%;
  left: 50%;
  translate: -50% -50%;
}

/* Alternative moderne (inset) */
.centered {
  position: absolute;
  inset: 0;
  margin: auto;
  width: fit-content;
  height: fit-content;
}
```

## inset (raccourci pour top/right/bottom/left)
```css
inset: 0;                  /* top:0 right:0 bottom:0 left:0 */
inset: 10px 20px;          /* vertical horizontal */
inset: 10px 20px 30px 40px; /* top right bottom left */
inset-inline: 16px;        /* left + right (logique) */
inset-block: 16px;         /* top + bottom (logique) */
```

## Float (heritage — preferer flex/grid)
```css
float: left;
float: right;
float: none;
clear: both;
```
