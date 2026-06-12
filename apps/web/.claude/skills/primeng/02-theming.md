# PrimeNG — Theming & Design Tokens

## Architecture des tokens (3 niveaux)

```
Primitive  →  Semantic  →  Component
(palette brute)  (usage nommé)  (composant spécifique)
blue-500       primary.color   button.background
```

**Règle** : toujours modifier au niveau le plus haut qui couvre le besoin.  
Ne jamais patcher via CSS custom si un token existe.

## Palette primitive disponible

`emerald` `green` `lime` `red` `orange` `amber` `yellow` `teal` `cyan` `sky`
`blue` `indigo` `violet` `purple` `fuchsia` `pink` `rose`
`slate` `gray` `zinc` `neutral` `stone`

Nuances : `50` `100` `200` `300` `400` `500` `600` `700` `800` `900` `950`

**Usage CSS** : `var(--p-blue-500)` (préfixe `p` par défaut)

## definePreset — personnalisation

```typescript
// src/app/theme/mypreset.ts
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

const MyPreset = definePreset(Aura, {
  // Remplacer la couleur primaire par indigo
  semantic: {
    primary: {
      50:  '{indigo.50}',
      100: '{indigo.100}',
      200: '{indigo.200}',
      300: '{indigo.300}',
      400: '{indigo.400}',
      500: '{indigo.500}',
      600: '{indigo.600}',
      700: '{indigo.700}',
      800: '{indigo.800}',
      900: '{indigo.900}',
      950: '{indigo.950}',
    },
  },
});

export default MyPreset;
```

```typescript
// app.config.ts
import MyPreset from './theme/mypreset';
providePrimeNG({ theme: { preset: MyPreset } })
```

## Surfaces light/dark

```typescript
const MyPreset = definePreset(Aura, {
  semantic: {
    colorScheme: {
      light: {
        surface: {
          50:  '{zinc.50}',
          100: '{zinc.100}',
          200: '{zinc.200}',
          300: '{zinc.300}',
          400: '{zinc.400}',
          500: '{zinc.500}',
          600: '{zinc.600}',
          700: '{zinc.700}',
          800: '{zinc.800}',
          900: '{zinc.900}',
          950: '{zinc.950}',
        },
      },
      dark: {
        surface: {
          50:  '{slate.50}',
          100: '{slate.100}',
          // ...
          950: '{slate.950}',
        },
      },
    },
  },
});
```

## Tokens de composant (override précis)

```typescript
const MyPreset = definePreset(Aura, {
  components: {
    button: {
      borderRadius: '2rem',           // pill buttons
      paddingX: '1.5rem',
    },
    inputtext: {
      borderColor: '{zinc.300}',
      focusBorderColor: '{primary.500}',
    },
  },
});
```

## $dt — accès programmatique aux tokens

```typescript
import { $dt } from '@primeuix/themes';

// Valeur d'un token
const primaryColor = $dt('primary.color');
// => { name: '--p-primary-color', variable: 'var(--p-primary-color)', value: { light: ..., dark: ... } }

const blue500 = $dt('blue.500');
// usage : `style="{ color: blue500.variable }"`
```

## Dark mode — toggle

```typescript
// darkModeSelector dans providePrimeNG options
darkModeSelector: '.my-app-dark'

// Toggle dans un service/composant
toggleDarkMode(): void {
  document.documentElement.classList.toggle('my-app-dark');
}

// Désactiver complètement
darkModeSelector: false
// ou
darkModeSelector: 'none'
```

## CSS Layer (éviter conflits)

```typescript
options: {
  cssLayer: {
    name: 'primeng',
    order: 'reset, primeng, app',
  },
}
```

```scss
// styles.scss
@layer reset, primeng, app;
@layer app {
  // vos styles ont la priorité sur PrimeNG
}
```

## Tokens sémantiques courants

| Token CSS var | Usage |
|---------------|-------|
| `var(--p-primary-color)` | Couleur primaire principale |
| `var(--p-primary-contrast-color)` | Texte sur fond primaire |
| `var(--p-surface-ground)` | Fond de la page |
| `var(--p-surface-card)` | Fond des cards |
| `var(--p-surface-border)` | Bordures |
| `var(--p-surface-hover)` | Hover state |
| `var(--p-text-color)` | Texte principal |
| `var(--p-text-muted-color)` | Texte secondaire |
| `var(--p-content-border-radius)` | Arrondi global composants |
