# Selecteurs CSS — Reference

## Selecteurs de base
```css
*                    /* universel */
element              /* type (h1, p, div) */
.class               /* classe */
#id                  /* identifiant */
[attr]               /* attribut present */
[attr="value"]       /* attribut egal */
[attr~="value"]      /* attribut contient le mot */
[attr|="value"]      /* attribut commence par value- */
[attr^="value"]      /* attribut commence par */
[attr$="value"]      /* attribut finit par */
[attr*="value"]      /* attribut contient */
[attr="value" i]     /* insensible a la casse */
```

## Combinateurs
```css
A B        /* descendant (n'importe quel niveau) */
A > B      /* enfant direct */
A + B      /* frere adjacent (immediatement apres) */
A ~ B      /* frere general (apres, meme niveau) */
A || B     /* colonne (tableaux) */
```

## Pseudo-classes
```css
/* Etat */
:hover :focus :active :visited :focus-visible :focus-within
:target :enabled :disabled :checked :indeterminate :valid :invalid
:required :optional :read-only :read-write :placeholder-shown
:default :in-range :out-of-range :autofill

/* Structure */
:first-child :last-child :only-child :nth-child(n) :nth-last-child(n)
:first-of-type :last-of-type :only-of-type :nth-of-type(n) :nth-last-of-type(n)
:root :empty

/* Logique */
:is(selector, selector)     /* match n'importe lequel (comme OR) */
:where(selector, selector)  /* comme :is mais specificite 0 */
:not(selector)              /* negation */
:has(selector)              /* parent selector (CSS4) */

/* Formules nth */
:nth-child(odd)        /* impair */
:nth-child(even)       /* pair */
:nth-child(3n)         /* chaque 3eme */
:nth-child(3n+1)       /* 1er, 4eme, 7eme... */
:nth-child(-n+3)       /* les 3 premiers */
:nth-last-child(-n+3)  /* les 3 derniers */
```

## Pseudo-elements
```css
::before         /* contenu avant */
::after          /* contenu apres */
::first-line     /* premiere ligne */
::first-letter   /* premiere lettre */
::selection      /* texte selectionne */
::placeholder    /* placeholder d'input */
::marker         /* puce de liste */
::backdrop       /* fond de dialog/fullscreen */
::file-selector-button  /* bouton input[type=file] */
```

## Specificite
```
!important     → 10 000 (eviter)
inline style   → 1 000
#id            → 100
.class / [attr] / :pseudo-class → 10
element / ::pseudo-element      → 1
* / :where()   → 0
```

Regles :
- Plus la specificite est haute, plus la regle est prioritaire
- A specificite egale, la derniere regle gagne
- :is() prend la specificite du selecteur le plus specifique
- :where() a toujours une specificite de 0
- :not() et :has() prennent la specificite de leur argument

## Nesting natif (CSS moderne)
```css
.card {
  background: white;
  border-radius: 8px;

  & h2 {
    font-size: 1.5rem;
  }

  &:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  &.active {
    border-color: blue;
  }

  @media (width >= 768px) {
    display: flex;
  }
}
```
