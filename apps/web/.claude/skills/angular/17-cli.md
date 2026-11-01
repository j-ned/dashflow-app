# Angular CLI — Reference

## Regles generales

- **Toujours** preferer `ng add` a `npm install` / `pnpm add` pour les librairies Angular — `ng add` execute les schematics d'installation automatiques
- Les commandes `ng generate` respectent les conventions du projet (prefixe, style, etc.)

## ng add — ajouter une librairie Angular

```bash
# Ajouter une librairie avec ses schematics d'installation
ng add @angular/material
ng add @angular/pwa
ng add @angular/ssr
ng add tailwindcss          # Tailwind CSS v4
ng add @ngrx/store

# Equivalent SANS schematics (a eviter pour les libs Angular)
pnpm add @angular/material  # NE configure PAS les styles, imports, etc.
```

### Pourquoi ng add

- Execute les **schematics** : modifie `angular.json`, `app.config.ts`, ajoute les styles, etc.
- Configure automatiquement les providers, imports et fichiers necessaires
- Certaines libs n'ont pas de schematics — dans ce cas `pnpm add` suffit

## ng generate — generer du code

### Configuration angular.json (a faire une fois par projet)

```json
{
  "schematics": {
    "@schematics/angular:component": {
      "type": "",
      "prefix": "",
      "inlineTemplate": true,
      "inlineStyle": true
    }
  }
}
```

- `"type": ""` — genere `user-card.ts` (pas `user-card.component.ts`) et `UserCard` (pas `UserCardComponent`)
- `"prefix": ""` — genere `selector: 'user-card'` (pas `selector: 'app-user-card'`)

### Composant

```bash
ng generate component features/users/application/components/user-card
# ou raccourci
ng g c features/users/application/components/user-card

# Options utiles
ng g c user-card --skip-tests                       # sans .spec.ts
ng g c user-card --flat                             # pas de sous-dossier
ng g c user-card --change-detection OnPush          # strategie OnPush
```

Sans la configuration `angular.json` ci-dessus, utiliser les flags explicites :
```bash
ng g c user-card --type="" --prefix="" --inline-template --inline-style
```

### Service / Use case

```bash
ng generate service features/users/domain/use-cases/get-users
ng g s core/auth

# Sans providedIn: 'root' (pour les services a scope limite)
ng g s my-service --provided-in=""
```

> Note : les fichiers generes par `ng g s` ont le suffixe `.service.ts`. Renommer manuellement si necessaire (ex: `auth.service.ts` → `auth.ts`, `users-api.ts`, etc.) selon ce que le fichier fait.

### Directive

```bash
ng generate directive shared/directives/highlight
ng g d shared/directives/auto-focus
```

### Pipe

```bash
ng generate pipe shared/pipes/truncate
ng g p shared/pipes/time-ago
```

### Guard

```bash
ng generate guard core/guards/auth
ng g guard core/guards/admin --functional  # guard fonctionnel (recommande)
```

### Environments

```bash
ng generate environments
# Cree :
#   src/environments/environment.ts
#   src/environments/environment.development.ts
# + configure angular.json pour le file replacement
```

## ng serve — serveur de developpement

```bash
ng serve                    # http://localhost:4200
ng serve --port 3000        # port custom
ng serve --open             # ouvrir le navigateur
ng serve --host 0.0.0.0     # accessible sur le reseau
```

### Configuration proxy

```typescript
// proxy.conf.json
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false,
    "changeOrigin": true
  }
}
```

```bash
ng serve --proxy-config proxy.conf.json
```

Ou dans `angular.json` :

```json
{
  "serve": {
    "options": {
      "proxyConfig": "proxy.conf.json"
    }
  }
}
```

## ng build — build de production

```bash
ng build                    # production par defaut
ng build --configuration=development  # build dev
ng build --output-path=dist/my-app    # chemin de sortie custom
```

### Ce que fait ng build (production)

- **AOT compilation** (Ahead-of-Time) — compile les templates au build
- **Tree-shaking** — supprime le code non utilise
- **Minification** — reduit la taille des bundles
- **Source maps** — desactivees par defaut en prod
- **Budget checks** — alerte si les bundles depassent les limites

### Budgets dans angular.json

```json
{
  "budgets": [
    {
      "type": "initial",
      "maximumWarning": "500kB",
      "maximumError": "1MB"
    },
    {
      "type": "anyComponentStyle",
      "maximumWarning": "4kB",
      "maximumError": "8kB"
    }
  ]
}
```

## ng test — lancer les tests

```bash
ng test                     # lance les tests une fois
ng test --watch             # mode watch (re-lance a chaque changement)
ng test --code-coverage     # generer le rapport de couverture
ng test --include='**/user*.spec.ts'  # filtrer les fichiers
```

## ng e2e — tests end-to-end

```bash
ng e2e                      # lance les tests e2e
# Necessite un builder e2e configure (Playwright, Cypress)
```

## ng update — mise a jour Angular

```bash
# Verifier les mises a jour disponibles
ng update

# Mettre a jour Angular et le CLI
ng update @angular/core @angular/cli

# Mettre a jour une lib tierce
ng update @angular/material

# Force (si les peer dependencies bloquent)
ng update @angular/core --force
```

### Migrations automatiques

`ng update` execute des **migrations automatiques** qui :

- Renomment les APIs depreciees
- Mettent a jour les imports
- Transforment la syntaxe (ex: NgModules → standalone, *ngIf → @if)
- Modifient `angular.json` si necessaire

```bash
# Voir les migrations sans les appliquer
ng update @angular/core --dry-run
```

## MCP Server Angular

Le CLI Angular expose un serveur MCP (Model Context Protocol) pour l'integration avec les outils IA.

```bash
npx @angular/cli mcp
```

Permet aux LLMs et outils compatibles MCP d'interagir avec le projet Angular (generation de code, analyse, etc.).

## Resume des commandes

| Commande | Raccourci | Description |
|----------|-----------|-------------|
| `ng new` | - | Creer un nouveau projet |
| `ng add` | - | Ajouter une librairie avec schematics |
| `ng generate component` | `ng g c` | Generer un composant |
| `ng generate service` | `ng g s` | Generer un service |
| `ng generate directive` | `ng g d` | Generer une directive |
| `ng generate pipe` | `ng g p` | Generer un pipe |
| `ng generate guard` | `ng g guard` | Generer un guard |
| `ng generate environments` | - | Generer les fichiers d'environnement |
| `ng serve` | - | Serveur de dev |
| `ng build` | - | Build production |
| `ng test` | - | Lancer les tests |
| `ng e2e` | - | Tests end-to-end |
| `ng update` | - | Mettre a jour Angular |
| `ng lint` | - | Linter (si configure) |
