# Flexbox CSS — Reference

## Container flex
```css
.container {
  display: flex;
  flex-direction: row;          /* row | row-reverse | column | column-reverse */
  flex-wrap: wrap;              /* nowrap | wrap | wrap-reverse */
  justify-content: center;     /* flex-start | flex-end | center | space-between | space-around | space-evenly */
  align-items: center;         /* flex-start | flex-end | center | stretch | baseline */
  align-content: flex-start;   /* quand wrap : gere les lignes multiples */
  gap: 16px;                   /* ecart entre les elements */
  row-gap: 16px;
  column-gap: 24px;
}
```

## Items flex
```css
.item {
  flex-grow: 1;       /* prendre l'espace restant (defaut: 0) */
  flex-shrink: 1;     /* retrecir si necessaire (defaut: 1) */
  flex-basis: auto;   /* taille de base (defaut: auto) */
  flex: 1;            /* raccourci : grow shrink basis → 1 1 0% */
  flex: 0 0 200px;    /* fixe a 200px, ne grandit ni ne retrecit */
  align-self: center; /* override align-items pour cet item */
  order: -1;          /* changer l'ordre d'affichage (defaut: 0) */
}
```

## Raccourci flex
```css
flex: 1;             /* 1 1 0% — prend tout l'espace dispo */
flex: auto;          /* 1 1 auto — grandit selon le contenu */
flex: none;          /* 0 0 auto — taille fixe */
flex: 0 0 200px;     /* fixe a 200px */
```

## Patterns courants

### Centrer parfaitement
```css
.center {
  display: flex;
  justify-content: center;
  align-items: center;
}
```

### Navigation horizontale
```css
.nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
```

### Footer en bas de page (sticky footer)
```css
body {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}
main { flex: 1; }
```

### Grille responsive simple
```css
.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.grid > * {
  flex: 1 1 300px;   /* min 300px, grandit pour remplir */
}
```
