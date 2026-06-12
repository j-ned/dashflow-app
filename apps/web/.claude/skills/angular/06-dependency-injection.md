# Dependency Injection Angular — Reference

## inject()

```typescript
private readonly router = inject(Router);
private readonly http = inject(HttpClient);
private readonly config = inject(APP_CONFIG);
```

- **Toujours** utiliser `inject()` — jamais l'injection par constructeur dans les composants (convention EAK)
- Fonctionne dans : champs de classe, constructeur, factory functions
- Doit etre appele dans un **injection context** (constructeur, factory, `runInInjectionContext`)

```typescript
// Options
inject(MyService, { optional: true });  // null si non trouve
inject(MyService, { self: true });      // seulement dans le meme injector
inject(MyService, { skipSelf: true });  // seulement dans les parents
inject(MyService, { host: true });      // seulement dans le host
```

## @Injectable

```typescript
@Injectable({ providedIn: 'root' })  // singleton global, tree-shakeable
export class UserService { }

@Injectable()                         // doit etre declare dans providers
export class FeatureScopedService { }
```

- `providedIn: 'root'` — recommande pour les singletons (tree-shakeable)
- `providedIn: 'platform'` — partage entre applications Angular sur la meme page

## Providers

### useClass — instancier une classe

```typescript
{ provide: Logger, useClass: BetterLogger }

// Conditionnel par environnement
{ provide: StorageService, useClass: environment.production ? CloudStorage : LocalStorage }
```

### useValue — valeur statique

```typescript
{ provide: API_URL, useValue: 'https://api.example.com' }
{ provide: APP_VERSION, useValue: '2.1.0' }
```

### useFactory — fonction avec logique

```typescript
// Avec deps (ancien style)
{
  provide: LoggerService,
  useFactory: (config: AppConfig) => new LoggerService(config.logLevel),
  deps: [APP_CONFIG],
}

// Avec inject() dans la factory (prefere)
{
  provide: ApiClient,
  useFactory: () => {
    const http = inject(HttpClient);
    const config = inject(APP_CONFIG);
    return new ApiClient(http, config.apiUrl);
  },
}
```

### useExisting — alias (meme instance)

```typescript
{ provide: OldLogger, useExisting: NewLogger }
// OldLogger et NewLogger pointent vers la meme instance
```

## InjectionToken

```typescript
// Token simple
export const API_URL = new InjectionToken<string>('api.url');

// Token avec factory et providedIn (auto-enregistre, tree-shakeable)
export const APP_CONFIG = new InjectionToken<AppConfig>('app.config', {
  providedIn: 'root',
  factory: () => ({
    apiUrl: 'https://api.example.com',
    version: '1.0.0',
    debug: false,
  }),
});
```

```typescript
// Utilisation
private readonly apiUrl = inject(API_URL);
private readonly config = inject(APP_CONFIG);
```

## Multi providers

```typescript
providers: [
  { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  { provide: HTTP_INTERCEPTORS, useClass: LoggingInterceptor, multi: true },
  { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
]
// inject(HTTP_INTERCEPTORS) retourne un tableau de toutes les instances
```

- `multi: true` — accumule les providers au lieu de les remplacer
- L'ordre du tableau correspond a l'ordre de declaration

## Scopes

### Bootstrap — singletons globaux

```typescript
// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withFetch()),
    { provide: GetPeopleGateway, useClass: HttpPeopleGateway },
  ],
};
```

### Composant — instance par composant

```typescript
@Component({
  providers: [CounterService],  // nouvelle instance pour chaque composant
})
export class CounterComponent {
  private readonly counter = inject(CounterService);
}
```

### Route — partages dans la branche

```typescript
{
  path: 'admin',
  loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES),
  providers: [
    AdminService,                    // partage entre toutes les routes admin
    { provide: ADMIN_API_KEY, useValue: '12345' },
  ],
}
```

## Inversion de dependance (EAK)

### Approche recommandee — Abstract class

```typescript
// domain/gateways/get-people.gateway.ts
export abstract class GetPeopleGateway {
  abstract getPeople(): Observable<People[]>;
}

// infra/http-people.gateway.ts
@Injectable()
export class HttpPeopleGateway implements GetPeopleGateway {
  private readonly http = inject(HttpClient);
  getPeople(): Observable<People[]> {
    return this.http.get<People[]>('/api/people');
  }
}

// app.config.ts
providers: [
  { provide: GetPeopleGateway, useClass: HttpPeopleGateway },
]

// composant
private readonly gateway = inject(GetPeopleGateway);
```

**Avantage** : `inject(GetPeopleGateway)` — syntaxe naturelle, pas besoin d'InjectionToken

### Alternative — InjectionToken

```typescript
// domain/gateways/get-people.gateway.ts
export interface GetPeopleGateway {
  getPeople(): Observable<People[]>;
}

export const GET_PEOPLE_GATEWAY = new InjectionToken<GetPeopleGateway>('GetPeopleGateway');

// app.config.ts
{ provide: GET_PEOPLE_GATEWAY, useClass: InMemoryPeopleGateway }

// composant
private readonly gateway = inject(GET_PEOPLE_GATEWAY);
```

## Pattern provide (librairies / configurations)

```typescript
// analytics.providers.ts
export function provideAnalytics(config: AnalyticsConfig): Provider[] {
  return [
    { provide: ANALYTICS_CONFIG, useValue: config },
    AnalyticsService,
  ];
}

// app.config.ts
providers: [
  provideAnalytics({ trackingId: 'GA-12345', enabled: true }),
]
```

```typescript
// Pattern avec options optionnelles
export function provideFeatureFlags(flags?: Partial<FeatureFlags>): Provider[] {
  return [
    {
      provide: FEATURE_FLAGS,
      useValue: { ...DEFAULT_FLAGS, ...flags },
    },
  ];
}
```

## Resolution hierarchique

```
Platform Injector
  └── Root Injector (bootstrapApplication providers)
        └── Component Injector (@Component providers)
              └── Child Component Injector
```

- Angular remonte la hierarchie jusqu'a trouver le provider
- Si non trouve et pas `optional: true` → erreur `NullInjectorError`
- Un provider au niveau composant **masque** le provider parent (meme token)

## Hierarchie des injecteurs

Angular utilise **deux arbres d'injecteurs** paralleles :

### ElementInjector (arbre des elements)

Cree implicitement pour chaque composant/directive. Configure via `providers` dans `@Component`.

```
AppComponent (ElementInjector)
  └── DashboardComponent (ElementInjector)
        └── WidgetComponent (ElementInjector)
```

### EnvironmentInjector (arbre d'environnement)

Configure au niveau application, modules ou routes. Inclut `bootstrapApplication`, `Route.providers`.

```
PlatformInjector
  └── Root EnvironmentInjector (bootstrapApplication providers)
        └── Route EnvironmentInjector (route providers)
              └── Child Route EnvironmentInjector
```

### Regles de resolution

1. Angular cherche d'abord dans l'**ElementInjector** du composant
2. Remonte l'arbre des **ElementInjectors** (parent, grand-parent, etc.)
3. Si non trouve, cherche dans l'**EnvironmentInjector** correspondant
4. Remonte l'arbre des **EnvironmentInjectors** jusqu'au root
5. Si non trouve → `NullInjectorError` (sauf si `optional: true`)

```
Composant demande inject(MyService)
  → ElementInjector du composant
    → ElementInjector du parent
      → ... (remonte jusqu'a root)
        → EnvironmentInjector de la route
          → Root EnvironmentInjector
            → PlatformInjector
              → NullInjector → ERREUR
```

## Modificateurs de resolution

### Syntaxe avec inject()

```typescript
// optional — retourne null si non trouve (pas d'erreur)
private readonly analytics = inject(AnalyticsService, { optional: true });

// self — cherche UNIQUEMENT dans l'injecteur du composant courant
private readonly logger = inject(Logger, { self: true });

// skipSelf — ignore l'injecteur courant, cherche dans les parents
private readonly config = inject(CONFIG_TOKEN, { skipSelf: true });

// host — cherche jusqu'a l'injecteur du composant hote (pas plus haut dans l'arbre element)
private readonly theme = inject(ThemeService, { host: true });
```

### Combinaisons

```typescript
// Optionnel + skipSelf
inject(ParentService, { optional: true, skipSelf: true });

// Self + optional — uniquement local, pas d'erreur si absent
inject(LocalCache, { self: true, optional: true });
```

| Modificateur | Portee de recherche |
|-------------|---------------------|
| _(aucun)_ | Tout l'arbre (element puis environnement) |
| `self` | Uniquement l'injecteur courant |
| `skipSelf` | Parents uniquement (ignore l'injecteur courant) |
| `host` | Jusqu'au composant hote (arbre element seulement) |
| `optional` | Retourne `null` au lieu de lancer une erreur |

## providers vs viewProviders

```typescript
@Component({
  // providers — visible par le composant ET ses enfants (y compris content children via ng-content)
  providers: [MyService],

  // viewProviders — visible par le composant et sa VIEW uniquement (pas les content children)
  viewProviders: [InternalService],
})
export class ParentComponent {}
```

```typescript
// Exemple concret
@Component({
  selector: 'app-tabs',
  viewProviders: [TabGroupService], // visible par TabComponent dans le template
  template: `
    <div class="tabs-header">
      <ng-content select="app-tab" /> <!-- TabComponent projete n'a PAS acces a TabGroupService -->
    </div>
  `,
})
export class TabsComponent {}
```

| Propriete | Visible par les enfants du template | Visible par les content children (ng-content) |
|-----------|-------------------------------------|-----------------------------------------------|
| `providers` | Oui | Oui |
| `viewProviders` | Oui | **Non** |

## Contexte d'injection

`inject()` ne fonctionne que dans un **contexte d'injection**. Voici les contextes valides :

### Ou inject() fonctionne

```typescript
@Component({ /* ... */ })
export class MyComponent {
  // 1. Initialiseur de champ — RECOMMANDE (convention EAK)
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  // 2. Constructeur
  constructor() {
    const service = inject(MyService); // OK
  }
}

// 3. Factory function dans un provider
{
  provide: ApiClient,
  useFactory: () => {
    const http = inject(HttpClient); // OK — factory est un contexte d'injection
    return new ApiClient(http);
  },
}

// 4. Guard / Resolver fonctionnel
const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService); // OK
  return auth.isLoggedIn();
};

// 5. Fonction d'initialisation d'application
{
  provide: APP_INITIALIZER,
  useFactory: () => {
    const config = inject(ConfigService); // OK
    return () => config.load();
  },
  multi: true,
}
```

### assertInInjectionContext()

Verifie a l'execution que le code s'execute dans un contexte d'injection. Utile pour les fonctions utilitaires reutilisables.

```typescript
import { assertInInjectionContext, inject } from '@angular/core';

function injectLogger(prefix: string): Logger {
  assertInInjectionContext(injectLogger); // throw si hors contexte
  const logger = inject(LoggerService);
  return logger.withPrefix(prefix);
}
```

### runInInjectionContext()

Cree manuellement un contexte d'injection pour executer du code avec `inject()`.

```typescript
import { runInInjectionContext, EnvironmentInjector } from '@angular/core';

export class MyComponent {
  private readonly injector = inject(EnvironmentInjector);

  // Utile quand inject() est necessaire en dehors du constructeur
  laterInit() {
    runInInjectionContext(this.injector, () => {
      const service = inject(MyService); // OK grace a runInInjectionContext
      service.doSomething();
    });
  }
}
```

- Utile pour les factory functions appelees en dehors du constructeur
- Utile pour les helpers qui ont besoin de `inject()`
- Utile pour creer dynamiquement des composants ou services
