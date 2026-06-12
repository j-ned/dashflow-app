# Configuration TypeScript — Reference

## tsconfig.json strict (recommande)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

## Ce que strict active
| Option | Description |
|--------|-------------|
| strictNullChecks | null et undefined sont des types distincts |
| noImplicitAny | erreur si type infere comme any |
| strictFunctionTypes | verification stricte des types de fonctions |
| strictBindCallApply | verifie bind, call, apply |
| strictPropertyInitialization | proprietes de classe doivent etre initialisees |
| noImplicitThis | erreur si this est any |
| alwaysStrict | ajoute "use strict" |
| useUnknownInCatchVariables | catch(e) est unknown au lieu de any |

## Options supplementaires recommandees
```json
{
  "noUnusedLocals": true,              // erreur si variable inutilisee
  "noUnusedParameters": true,          // erreur si parametre inutilise
  "noFallthroughCasesInSwitch": true,  // erreur si switch sans break
  "noUncheckedIndexedAccess": true,    // array[i] retourne T | undefined
  "exactOptionalPropertyTypes": true   // distingue undefined de "absent"
}
```

## Angular tsconfig
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "useDefineForClassFields": false,
    "experimentalDecorators": true,
    "lib": ["ES2022", "dom"]
  }
}
```

## NestJS tsconfig
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2021",
    "strict": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## Hono / Drizzle tsconfig
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist"
  }
}
```
