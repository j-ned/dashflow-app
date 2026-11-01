# Tailwind CSS v4 — Setup

## IMPORTANT : Tailwind v4 ≠ v3
- PAS de tailwind.config.js (configuration dans le CSS via @theme)
- PAS de @tailwind base/components/utilities — utiliser @import "tailwindcss"
- Configuration via variables CSS dans @theme

## Installation avec Vite (Angular, etc.)
```bash
pnpm add tailwindcss @tailwindcss/vite
```

```typescript
// vite.config.ts
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],
})
```

## Installation avec PostCSS (alternatives)
```bash
pnpm add tailwindcss @tailwindcss/postcss postcss
```

```json
// .postcssrc.json
{ "plugins": { "@tailwindcss/postcss": {} } }
```

## CSS principal
```css
/* styles.css */
@import "tailwindcss";
```
C'est tout. Pas de @tailwind, pas de config JS.

## Installation avec Angular (ng add)
```bash
ng add tailwindcss
```
Configure automatiquement le projet.

## Viewport meta (obligatoire)
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```
