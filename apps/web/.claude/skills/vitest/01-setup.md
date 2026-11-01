# Vitest — Setup et Configuration

## Installation
```bash
pnpm add -D vitest
```
Prerequis : Vite >= 6.0.0, Node >= 20.0.0

## Configuration
```typescript
// vitest.config.ts (standalone)
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,             // describe, it, expect sans import
    environment: 'node',       // 'node' | 'jsdom' | 'happy-dom'
    include: ['**/*.{test,spec}.{ts,js}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
})
```

```typescript
// Ou integre dans vite.config.ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    globals: true,
  },
})
```

## Scripts npm
```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Conventions de fichiers
- *.test.ts ou *.spec.ts
- Placer pres du fichier teste (convention EAK)

## CLI
```bash
vitest                    # watch mode (defaut)
vitest run                # execution unique
vitest run src/utils      # filtrer par chemin
vitest run -t "user"      # filtrer par nom de test
vitest --reporter=verbose # reporter detaille
vitest --coverage         # avec couverture
```

## Multi-projet
```typescript
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', environment: 'node' } },
      { test: { name: 'browser', environment: 'happy-dom' } },
    ],
  },
})
```
