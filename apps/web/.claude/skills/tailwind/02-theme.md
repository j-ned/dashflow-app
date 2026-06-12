# Theme Tailwind v4 — Reference (@theme)

## @theme — definir les design tokens
Les variables @theme creent automatiquement les classes utilitaires correspondantes.

```css
@import "tailwindcss";

@theme {
  --color-brand-500: oklch(0.72 0.11 178);
  --font-display: "Satoshi", sans-serif;
}
```
→ Genere : bg-brand-500, text-brand-500, font-display, etc.

## Namespaces disponibles
| Namespace | Classes generees |
|-----------|-----------------|
| --color-* | bg-*, text-*, border-*, fill-*, stroke-* |
| --font-* | font-* (familles) |
| --text-* | text-* (tailles) |
| --font-weight-* | font-* (poids) |
| --tracking-* | tracking-* (letter-spacing) |
| --leading-* | leading-* (line-height) |
| --breakpoint-* | sm:, md:, lg:, xl:, 2xl: |
| --container-* | @sm:, @md:, @lg: (container queries) |
| --spacing-* | p-*, m-*, gap-*, w-*, h-* |
| --radius-* | rounded-* |
| --shadow-* | shadow-* |
| --blur-* | blur-* |
| --ease-* | ease-* |
| --animate-* | animate-* |

## Etendre le theme (ajouter sans supprimer les defauts)
```css
@theme {
  --color-brand-500: #3b82f6;
  --font-display: "Satoshi", sans-serif;
  --breakpoint-3xl: 120rem;
}
```

## Remplacer un namespace entier
```css
@theme {
  --color-*: initial;       /* reset toutes les couleurs */
  --color-white: #fff;
  --color-black: #000;
  --color-brand: #3b82f6;
}
```

## Theme from scratch (aucun defaut)
```css
@theme {
  --*: initial;            /* reset TOUT */
  --spacing: 4px;
  --color-primary: oklch(0.72 0.11 221);
  --font-body: Inter, sans-serif;
}
```

## Breakpoints par defaut
```css
--breakpoint-sm: 40rem;    /* 640px */
--breakpoint-md: 48rem;    /* 768px */
--breakpoint-lg: 64rem;    /* 1024px */
--breakpoint-xl: 80rem;    /* 1280px */
--breakpoint-2xl: 96rem;   /* 1536px */
```

## Spacing par defaut
```css
--spacing: 0.25rem;  /* 1 unite = 4px. p-4 = 16px, m-8 = 32px */
```

## Animations custom
```css
@theme {
  --animate-fade-in: fade-in 0.3s ease-out;

  @keyframes fade-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
}
```

## Partager un theme entre projets
```css
/* packages/brand/theme.css */
@theme {
  --color-primary: oklch(0.72 0.11 221);
  --font-body: Inter, sans-serif;
}

/* packages/app/styles.css */
@import "tailwindcss";
@import "../brand/theme.css";
```

## Utiliser les variables du theme dans le CSS custom
```css
@layer components {
  .card {
    background: var(--color-white);
    border-radius: var(--radius-lg);
    padding: var(--spacing-6);
    box-shadow: var(--shadow-xl);
  }
}
```
