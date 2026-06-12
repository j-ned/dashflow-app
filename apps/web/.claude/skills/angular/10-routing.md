# Routing Angular — Reference

## Setup

```typescript
// app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'users', component: UsersList },
  { path: 'users/:id', component: UserDetail },
  { path: '**', component: NotFound },  // toujours en dernier
];
```

```typescript
// app.config.ts
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withComponentInputBinding(),  // binder les params de route aux inputs
    ),
  ],
};
```

```typescript
// app.ts
@Component({
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class App {}
```

## Lazy loading

### loadComponent — composant seul

```typescript
{
  path: 'about',
  loadComponent: () => import('./about').then(m => m.About),
}
```

### loadChildren — routes de feature

```typescript
{
  path: 'admin',
  loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES),
}
```

```typescript
// admin/admin.routes.ts
export const ADMIN_ROUTES: Routes = [
  { path: '', component: AdminDashboard },
  { path: 'users', component: AdminUsers },
  { path: 'settings', component: AdminSettings },
];
```

### Conventions EAK

- Ne **JAMAIS** lazy-loader la route par defaut (path: '')
- Constantes de routes en `SCREAMING_CASE` : `ME_ROUTES`, `ADMIN_ROUTES`
- `routerLink` relatif dans les features : `routerLink="settings"` au lieu de `routerLink="/admin/settings"`

## Routes imbriquees

```typescript
{
  path: 'product/:id',
  component: ProductDetail,
  children: [
    { path: '', redirectTo: 'info', pathMatch: 'full' },
    { path: 'info', component: ProductInfo },
    { path: 'reviews', component: ProductReviews },
  ],
}
```

```typescript
// ProductDetail doit contenir un <router-outlet />
@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <h1>Produit</h1>
    <nav>
      <a routerLink="info" routerLinkActive="active">Info</a>
      <a routerLink="reviews" routerLinkActive="active">Avis</a>
    </nav>
    <router-outlet />
  `,
})
export class ProductDetail {}
```

## Route providers

```typescript
{
  path: 'admin',
  loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES),
  providers: [
    AdminService,
    { provide: ADMIN_API_KEY, useValue: '12345' },
  ],
}
```

- Les providers de route sont partages entre toutes les routes enfants
- Cree un **environment injector** specifique a cette branche

## Titre de page

```typescript
{ path: 'about', component: About, title: 'A propos' }
{ path: 'users/:id', component: UserDetail, title: userTitleResolver }
```

```typescript
// Title resolver
const userTitleResolver: ResolveFn<string> = (route) => {
  return inject(UserService).getUser(route.paramMap.get('id')!).pipe(
    map(user => `Profil de ${user.name}`),
  );
};
```

## withComponentInputBinding

Avec `withComponentInputBinding()` dans `provideRouter()`, les composants recoivent automatiquement les parametres de route comme inputs :

```typescript
// Route : { path: 'users/:id', component: UserDetail }
// URL : /users/42

@Component({ ... })
export class UserDetail {
  readonly id = input.required<string>();        // recoit '42' du path param
  readonly tab = input<string>();                 // recoit la valeur du query param ?tab=info
  readonly user = input<User>();                  // recoit la valeur du resolver 'user'
}
```

## Guards fonctionnels (EAK)

### CanMatch — bloque le matching de route

```typescript
import { CanMatchFn, Router } from '@angular/router';

const isAdmin: CanMatchFn = () => {
  const auth = inject(AuthService);
  if (auth.isAdmin()) return true;
  return inject(Router).createUrlTree(['/login']);
};

// Utilisation
{ path: 'admin', canMatch: [isAdmin], loadChildren: () => ... }
```

- Retourne `boolean`, `UrlTree`, `Observable`, ou `Promise`
- `UrlTree` pour rediriger
- Si `false`, Angular essaie la route suivante

### CanMatch — meme path, composant different selon le param

Permet d'avoir **plusieurs routes avec le meme path** mais des composants differents selon une condition sur les parametres :

```typescript
const routes: Routes = [
  {
    path: 'profile/:plan',
    canMatch: [(route) => {
      return route.params['plan'] === 'premium';
    }],
    component: PremiumProfile,
  },
  {
    path: 'profile/:plan',
    component: DefaultProfile,  // fallback si canMatch retourne false
  },
];
```

- `/profile/premium` → `PremiumProfile`
- `/profile/free` → `DefaultProfile`
- Le premier `canMatch` qui retourne `true` gagne, sinon Angular passe a la route suivante
- Pattern puissant pour le feature gating, A/B testing, ou les plans tarifaires

### CanActivate — bloque l'activation

```typescript
const isAuthenticated: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isLoggedIn()) return true;
  return inject(Router).createUrlTree(['/login'], {
    queryParams: { returnUrl: inject(Router).url },
  });
};

{ path: 'dashboard', canActivate: [isAuthenticated], component: Dashboard }
```

### CanDeactivate — empeche de quitter

```typescript
interface HasDirtyForm {
  isDirty(): boolean;
}

const canLeave: CanDeactivateFn<HasDirtyForm> = (component) => {
  if (component.isDirty()) {
    return confirm('Vous avez des modifications non sauvegardees. Quitter ?');
  }
  return true;
};

{ path: 'edit', component: EditForm, canDeactivate: [canLeave] }
```

```typescript
// Le composant implemente l'interface
export class EditForm implements HasDirtyForm {
  isDirty(): boolean {
    return this.form.dirty;
  }
}
```

## Resolvers

```typescript
const userResolver: ResolveFn<User> = (route) => {
  return inject(UserService).getUser(route.paramMap.get('id')!);
};

{
  path: 'user/:id',
  component: UserDetail,
  resolve: { user: userResolver },
}
```

Avec `withComponentInputBinding()`, le composant recoit l'input `user` automatiquement :

```typescript
@Component({ ... })
export class UserDetail {
  readonly user = input.required<User>();  // fourni par le resolver
}
```

Sans `withComponentInputBinding()`, utiliser `ActivatedRoute` :

```typescript
private readonly route = inject(ActivatedRoute);
readonly user = toSignal(this.route.data.pipe(map(d => d['user'])));
```

## Static data

```typescript
{ path: 'about', component: About, data: { analyticsId: '456', breadcrumb: 'A propos' } }
```

Accessible dans le composant via input (avec `withComponentInputBinding`) :

```typescript
readonly analyticsId = input<string>();
readonly breadcrumb = input<string>();
```

## Navigation programmatique

```typescript
private readonly router = inject(Router);

// Navigation absolue
this.router.navigate(['/users', userId]);

// Navigation relative
private readonly route = inject(ActivatedRoute);
this.router.navigate(['details'], { relativeTo: this.route });

// Avec query params
this.router.navigate(['/search'], {
  queryParams: { q: 'angular', page: 1 },
  queryParamsHandling: 'merge', // 'merge' | 'preserve' | ''
});

// Remplacer l'historique (pas de retour arriere)
this.router.navigate(['/dashboard'], { replaceUrl: true });
```

## RouterLink

```html
<!-- Absolu -->
<a routerLink="/users">Utilisateurs</a>

<!-- Avec parametres -->
<a [routerLink]="['/users', user.id]">{{ user.name }}</a>

<!-- Relatif (dans une feature) -->
<a routerLink="settings">Parametres</a>
<a routerLink="../other">Autre</a>

<!-- Avec query params -->
<a [routerLink]="['/search']" [queryParams]="{ q: 'test' }">Rechercher</a>

<!-- Active link -->
<a routerLink="/users" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
  Utilisateurs
</a>
```

## Router features supplementaires

```typescript
provideRouter(
  routes,
  withComponentInputBinding(),
  withViewTransitions(),              // animations de transition de page
  withRouterConfig({
    onSameUrlNavigation: 'reload',    // re-execute les guards/resolvers
    paramsInheritanceStrategy: 'always', // heriter les params des parents
  }),
  withHashLocation(),                 // mode hash (#/path)
  withPreloading(PreloadAllModules),  // precharger les modules lazy
  withDebugTracing(),                 // log tous les evenements router dans la console (dev seulement)
)
```

## Outlets nommes (routes secondaires)

Les outlets nommes permettent d'afficher plusieurs composants routes simultanement.

```typescript
// Configuration des routes
const routes: Routes = [
  { path: 'users', component: UsersList },
  { path: 'chat', component: Chat, outlet: 'sidebar' },
  { path: 'notifications', component: Notifications, outlet: 'sidebar' },
];
```

```html
<!-- Template avec outlet principal + outlet nomme -->
<router-outlet />
<router-outlet name="sidebar" />
```

```html
<!-- Navigation vers un outlet nomme -->
<a [routerLink]="[{ outlets: { sidebar: ['chat'] } }]">Ouvrir le chat</a>

<!-- Fermer un outlet nomme -->
<a [routerLink]="[{ outlets: { sidebar: null } }]">Fermer</a>
```

```typescript
// Navigation programmatique
this.router.navigate([{ outlets: { sidebar: ['chat'] } }]);

// URL resultante : /users(sidebar:chat)
```

## Evenements du cycle de vie du Router

Le Router emet des evenements a chaque etape de la navigation.

| Evenement | Moment |
|-----------|--------|
| `NavigationStart` | Debut de la navigation |
| `RoutesRecognized` | Routes correspondantes trouvees |
| `GuardsCheckStart` | Debut de l'evaluation des guards |
| `GuardsCheckEnd` | Fin de l'evaluation des guards |
| `ResolveStart` | Debut de la resolution des resolvers |
| `ResolveEnd` | Fin de la resolution des resolvers |
| `NavigationEnd` | Navigation terminee avec succes |
| `NavigationCancel` | Navigation annulee (guard, redirect) |
| `NavigationError` | Navigation echouee (erreur) |

```typescript
import { Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';

export class App {
  private readonly router = inject(Router);

  protected readonly isNavigating = signal(false);

  constructor() {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.isNavigating.set(true);
      }
      if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.isNavigating.set(false);
      }
    });
  }
}
```

### withDebugTracing()

```typescript
// Ajouter dans provideRouter pour logger TOUS les evenements dans la console
provideRouter(routes, withDebugTracing())
// A utiliser uniquement en developpement — tres verbeux
```

## routerOutletData — passer des donnees via le RouterOutlet

Le token `ROUTER_OUTLET_DATA` permet de passer des donnees du composant parent aux composants routes enfants.

```typescript
import { ROUTER_OUTLET_DATA } from '@angular/router';

// Composant parent avec le router-outlet
@Component({
  selector: 'dashboard',
  imports: [RouterOutlet],
  template: `
    <router-outlet [routerOutletData]="outletData()" />
  `,
})
export class Dashboard {
  protected readonly outletData = signal({ theme: 'dark', sidebar: true });
}
```

```typescript
// Composant route enfant — recoit les donnees
@Component({ /* ... */ })
export class DashboardWidget {
  // Injecter les donnees passees par le router-outlet parent
  private readonly outletData = inject(ROUTER_OUTLET_DATA) as Signal<{ theme: string; sidebar: boolean }>;

  protected readonly theme = computed(() => this.outletData().theme);
}
```

## Strategies de chargement

### loadComponent avec inject() — chargement conditionnel

Le contexte d'injection est disponible dans `loadComponent`, ce qui permet d'utiliser `inject()` pour charger conditionnellement un composant (feature flags, A/B testing).

```typescript
{
  path: 'dashboard',
  loadComponent: () => {
    const featureFlags = inject(FeatureFlagService);
    if (featureFlags.isEnabled('new-dashboard')) {
      return import('./dashboard-v2').then(m => m.DashboardV2);
    }
    return import('./dashboard').then(m => m.Dashboard);
  },
}
```

## Strategies de rendu — resume

| Strategie | Acronyme | Quand utiliser | SEO | Interactivite |
|-----------|----------|----------------|-----|---------------|
| Client-Side Rendering | CSR | Apps internes, dashboards, SPAs interactives | Non | Immediate |
| Server-Side Rendering | SSR | Contenu dynamique + SEO (e-commerce, blogs) | Oui | Apres hydratation |
| Static Site Generation | SSG | Contenu statique + SEO (landing pages, docs) | Oui | Apres hydratation |

### Matrice de decision

```
Besoin de SEO ?
  ├── NON → CSR (defaut Angular)
  └── OUI → Contenu dynamique ?
              ├── OUI → SSR (provideServerRendering())
              └── NON → SSG (prerender: true dans angular.json)
```

> Voir `18-rendering-strategies.md` pour les details d'implementation.
