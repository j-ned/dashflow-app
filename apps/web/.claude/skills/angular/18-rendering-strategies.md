# Strategies de rendu Angular — Reference

## Vue d'ensemble

| Strategie | Description | SEO | TTFB | Interactivite | Contenu |
|-----------|-------------|-----|------|---------------|---------|
| **CSR** | Client-Side Rendering | Non | Rapide | Immediate | Dynamique |
| **SSR** | Server-Side Rendering | Oui | Plus lent | Apres hydratation | Dynamique |
| **SSG** | Static Site Generation | Oui | Tres rapide | Apres hydratation | Statique |

## CSR — Client-Side Rendering (defaut)

Le navigateur recoit un HTML minimal et JavaScript construit le DOM entierement cote client.

```typescript
// app.config.ts — configuration par defaut, rien de special
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withFetch()),
  ],
};
```

### Quand utiliser CSR

- Applications internes (backoffice, dashboards, outils d'equipe)
- SPAs interactives sans besoin de SEO
- Applications derriere authentification
- Applications temps reel (chat, monitoring)

### Avantages / Inconvenients

| Avantage | Inconvenient |
|----------|-------------|
| Simple a deployer (fichiers statiques) | Pas de SEO |
| Pas de serveur Node.js | Ecran blanc au premier chargement |
| Navigation instantanee apres chargement | Bundle JavaScript potentiellement lourd |
| Hebergement pas cher (CDN) | Performance mobile degradee |

## SSR — Server-Side Rendering

Le serveur genere le HTML complet pour chaque requete. Le client recoit une page pre-rendue.

### Setup

```bash
ng add @angular/ssr
```

```typescript
// app.config.server.ts
import { mergeApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { provideServerRoutesConfig } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    provideServerRoutesConfig(serverRoutes),
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
```

```typescript
// app.routes.server.ts
import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: '**', renderMode: RenderMode.Server },
];
```

### Quand utiliser SSR

- Sites e-commerce (pages produits)
- Blogs, portails d'actualites
- Contenu dynamique qui doit etre indexe
- Pages de profil publiques

### Avantages / Inconvenients

| Avantage | Inconvenient |
|----------|-------------|
| SEO complet | Necessite un serveur Node.js |
| Premier affichage rapide | TTFB plus lent (rendu serveur) |
| Preview dans les reseaux sociaux | Cout serveur plus eleve |
| Contenu dynamique indexable | Complexite de deploiement |

## SSG — Static Site Generation (pre-rendu)

Les pages sont generees au moment du build. Chaque route produit un fichier HTML statique.

### Configuration

```typescript
// app.routes.server.ts
import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Pages statiques — pre-rendues au build
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'about', renderMode: RenderMode.Prerender },
  { path: 'contact', renderMode: RenderMode.Prerender },

  // Pages dynamiques — rendues cote serveur
  { path: 'products/:id', renderMode: RenderMode.Server },

  // Pages interactives — rendues cote client
  { path: 'dashboard', renderMode: RenderMode.Client },
];
```

### Quand utiliser SSG

- Landing pages, pages marketing
- Documentation, FAQ
- Pages "A propos", mentions legales
- Tout contenu qui ne change pas a chaque requete

### Avantages / Inconvenients

| Avantage | Inconvenient |
|----------|-------------|
| TTFB ultra rapide (fichiers statiques) | Contenu fige au moment du build |
| SEO parfait | Rebuild necessaire pour chaque changement |
| Deploiement CDN | Ne convient pas au contenu dynamique |
| Cout minimal | Pages parametriques complexes a pre-rendre |

## Hydratation

L'hydratation est le processus par lequel Angular "attache" l'interactivite JavaScript au HTML pre-rendu (SSR/SSG).

### Hydratation complete (defaut)

```typescript
// Active par defaut avec provideServerRendering()
// Angular hydrate toute la page d'un coup
```

### Hydratation incrementale avec @defer

```typescript
@Component({
  template: `
    <header>Contenu hydrate immediatement</header>

    @defer (hydrate on viewport) {
      <app-comments />  <!-- hydrate uniquement quand visible -->
    }

    @defer (hydrate on interaction) {
      <app-sidebar />  <!-- hydrate au premier clic/focus -->
    }

    @defer (hydrate on idle) {
      <app-footer />  <!-- hydrate quand le navigateur est inactif -->
    }
  `,
})
export class ArticleComponent {}
```

### Triggers d'hydratation

| Trigger | Quand l'hydratation se declenche |
|---------|----------------------------------|
| `hydrate on viewport` | Quand l'element entre dans le viewport |
| `hydrate on interaction` | Au premier clic, focus ou touche |
| `hydrate on idle` | Quand le navigateur est inactif |
| `hydrate on timer(Xms)` | Apres un delai |
| `hydrate on immediate` | Immediatement |
| `hydrate never` | Jamais — reste du HTML statique |

### Replay d'evenements (Event Replay)

Pendant l'hydratation, les clics utilisateur sont captures et rejoues une fois l'hydratation terminee.

```typescript
// app.config.ts
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(withEventReplay()),
  ],
};
```

- L'utilisateur clique sur un bouton avant l'hydratation
- Angular capture l'evenement
- Apres hydratation, l'evenement est rejoue automatiquement
- UX fluide — l'utilisateur ne remarque pas le delai

## Matrice de decision

```
Application interne / dashboard ?
  └── OUI → CSR

Besoin de SEO ?
  ├── NON → CSR
  └── OUI → Contenu change a chaque requete ?
              ├── OUI → SSR
              └── NON → Contenu change rarement ?
                          ├── OUI → SSG
                          └── NON → SSR

Performance critique au premier chargement ?
  └── OUI → SSR/SSG + hydratation incrementale (@defer)
```

## Approche mixte — meilleures pratiques

Un meme projet peut combiner les trois strategies :

```typescript
// app.routes.server.ts
export const serverRoutes: ServerRoute[] = [
  // SSG — pages statiques
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'about', renderMode: RenderMode.Prerender },
  { path: 'pricing', renderMode: RenderMode.Prerender },

  // SSR — pages dynamiques indexables
  { path: 'blog/:slug', renderMode: RenderMode.Server },
  { path: 'products/:id', renderMode: RenderMode.Server },

  // CSR — pages interactives
  { path: 'dashboard/**', renderMode: RenderMode.Client },
  { path: 'admin/**', renderMode: RenderMode.Client },
];
```
