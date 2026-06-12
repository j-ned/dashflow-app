# Couleurs et Fonds CSS — Reference

## Formats de couleur
```css
/* Nomme */
color: red;
color: transparent;
color: currentColor;           /* herite de la couleur du texte */

/* Hex */
color: #ff0000;
color: #f00;                   /* raccourci */
color: #ff000080;              /* avec opacite */

/* RGB / RGBA */
color: rgb(255, 0, 0);
color: rgb(255 0 0 / 50%);     /* syntaxe moderne avec opacite */

/* HSL (recommande pour les themes) */
color: hsl(0, 100%, 50%);     /* teinte, saturation, luminosite */
color: hsl(0 100% 50% / 50%); /* avec opacite */

/* OKLCH (recommande pour le design — Tailwind v4) */
color: oklch(0.72 0.11 178);
color: oklch(0.72 0.11 178 / 50%);

/* color-mix (CSS moderne) */
color: color-mix(in oklch, blue 70%, white);
```

## Backgrounds
```css
background-color: #f0f0f0;
background-image: url('image.jpg');
background-image: linear-gradient(to right, #f00, #00f);
background-image: radial-gradient(circle, #f00, #00f);
background-image: conic-gradient(from 0deg, red, yellow, green, blue, red);
background-size: cover;        /* couvre tout le conteneur */
background-size: contain;     /* contenu entier visible */
background-position: center;
background-repeat: no-repeat;
background-attachment: fixed;  /* parallaxe */

/* Raccourci */
background: #f0f0f0 url('bg.jpg') no-repeat center / cover;

/* Multiple backgrounds */
background:
  linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)),
  url('photo.jpg') center / cover no-repeat;
```

## Bordures
```css
border: 1px solid #ccc;
border-radius: 8px;
border-radius: 50%;            /* cercle */
border-radius: 8px 8px 0 0;   /* top-left top-right bottom-right bottom-left */
outline: 2px solid blue;       /* ne prend pas d'espace */
outline-offset: 2px;
```

## Ombres
```css
/* Box shadow */
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);  /* interne */

/* Text shadow */
text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);

/* Drop shadow (pour les formes/SVG) */
filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));
```

## Opacite
```css
opacity: 0.5;                  /* tout l'element */
background: rgb(0 0 0 / 50%); /* seulement la couleur */
```
