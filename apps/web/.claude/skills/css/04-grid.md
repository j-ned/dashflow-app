# CSS Grid — Reference

## Container grid
```css
.container {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;        /* 3 colonnes */
  grid-template-columns: repeat(3, 1fr);      /* 3 colonnes egales */
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); /* responsive */
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));  /* responsive (etire) */
  grid-template-rows: auto 1fr auto;          /* header-main-footer */
  gap: 16px;                                   /* ecart */
  row-gap: 16px;
  column-gap: 24px;
}
```

## auto-fill vs auto-fit
```css
/* auto-fill : cree des colonnes vides si l'espace le permet */
grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));

/* auto-fit : etire les colonnes existantes pour remplir l'espace */
grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
```

## Unites de taille
```css
1fr              /* fraction de l'espace restant */
200px            /* taille fixe */
auto             /* taille du contenu */
minmax(200px, 1fr) /* entre 200px et 1fr */
min-content      /* taille minimale du contenu */
max-content      /* taille maximale du contenu */
fit-content(300px) /* min entre max-content et 300px */
```

## Placement des items
```css
.item {
  grid-column: 1 / 3;         /* de la colonne 1 a 3 */
  grid-column: 1 / span 2;    /* colonne 1, s'etend sur 2 */
  grid-column: 1 / -1;        /* toute la largeur */
  grid-row: 1 / 3;            /* de la ligne 1 a 3 */
  grid-area: 1 / 1 / 3 / 3;   /* row-start / col-start / row-end / col-end */
}
```

## Zones nommees
```css
.layout {
  display: grid;
  grid-template-columns: 250px 1fr;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    "header  header"
    "sidebar main"
    "footer  footer";
  min-height: 100dvh;
}
header  { grid-area: header; }
aside   { grid-area: sidebar; }
main    { grid-area: main; }
footer  { grid-area: footer; }
```

## Alignement
```css
/* Container */
justify-items: center;       /* horizontal des items dans leur cellule */
align-items: center;         /* vertical des items dans leur cellule */
place-items: center;         /* raccourci */
justify-content: center;     /* horizontal de la grille entiere */
align-content: center;       /* vertical de la grille entiere */
place-content: center;       /* raccourci */

/* Item individuel */
justify-self: end;
align-self: center;
place-self: center end;
```

## Patterns courants

### Layout Holy Grail
```css
.layout {
  display: grid;
  grid-template: auto 1fr auto / 1fr;
  min-height: 100dvh;
}
```

### Grille d'images responsive
```css
.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}
```

### Sidebar + contenu
```css
.page {
  display: grid;
  grid-template-columns: minmax(200px, 300px) 1fr;
  gap: 24px;
}
@media (max-width: 768px) {
  .page { grid-template-columns: 1fr; }
}
```

## Subgrid
```css
.parent {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}
.child {
  grid-column: span 3;
  display: grid;
  grid-template-columns: subgrid;  /* herite les colonnes du parent */
}
```
