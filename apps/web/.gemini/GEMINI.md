# Configuration Gemini - Projet Coaching Life  
  
You are an expert in TypeScript, Angular 21, TailwindCSS v4, Supabase, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices. You apply Clean Architecture principles and prioritize zoneless change detection throughout the project.  
  
---  
  
## Stack technique  
  
| Technologie | Version / Détail |  
| ------------- | ----------------- |  
| **Framework** | Angular 21.2.0 (zoneless par défaut) |  
| **CSS** | TailwindCSS v4 |  
| **Backend** | Supabase |  
| **SSR** | Angular SSR + Express 5 |  
| **Hébergement** | GitHub Pages |  
| **Package Manager** | pnpm |  
| **Tests** | Vitest 4.x |  
| **Change Detection** | Zoneless (pas de Zone.js) |  
  
---  
  
## Structure du projet (Clean Architecture)  
  
```bash  
src/app/  
├── core/                            # Services singleton, interceptors, guards  
│   ├── services/  
│   │   └── supabase/  
│   ├── interceptors/  
│   ├── guards/  
│   └── ...  
│  
├── features/                        # Features business (lazy loadable, clean archi)  
│   ├── booking/  
│   │   ├── domain/  
│   │   │   ├── models/  
│   │   │   ├── gateways/  
│   │   │   └── use-cases/  
│   │   ├── infra/  
│   │   │   ├── adapters/  
│   │   │   ├── http-booking.gateway.ts  
│   │   │   └── in-memory-booking.gateway.ts  
│   │   ├── components/  
│   │   └── booking.routes.ts  
│   ├── contact/  
│   │   ├── domain/  
│   │   ├── infra/  
│   │   └── components/  
│   ├── dashboard/  
│   │   ├── domain/  
│   │   ├── infra/  
│   │   ├── pages/  
│   │   │   ├── dashboard-home/  
│   │   │   ├── dashboard-appointments/  
│   │   │   └── dashboard-messages/  
│   │   └── dashboard.routes.ts  
│   └── reviews/  
│       ├── domain/  
│       ├── infra/  
│       └── components/  
│  
├── pages/                           # Pages publiques (smart components)  
│   ├── home/  
│   ├── life-coach/  
│   ├── personal-development/  
│   ├── equine-coaching/  
│   └── neuroatypical-parents/  
│  
├── layout/                          # Layouts (shell components)  
│   ├── main-layout/  
│   └── dashboard-layout/  
│  
├── shared/                          # Composants UI, directives, pipes réutilisables  
│   ├── components/  
│   ├── directives/  
│   └── pipes/  
│  
├── app.ts  
├── app.html  
├── app.config.ts  
└── app.routes.ts  
```  
  
| Dossier | Contenu | Règle |  
| --------- | --------- | ------- |  
| **core/** | Services singleton, interceptors, guards | Importé uniquement dans `app.config.ts` |  
| **features/*/domain/** | Models, gateways (abstract classes), use cases | Pure TypeScript, AUCUNE dépendance Angular (sauf `@Injectable` pragmatique) |  
| **features/*/infra/** | Implémentations HTTP/in-memory, adapters, types API | Dépend du domain, jamais l'inverse |  
| **features/*/pages/** | Smart components (pages dashboard) | Injectent les use cases, orchestrent |  
| **features/*/components/** | Dumb components | Inputs/outputs uniquement, aucun service |  
| **pages/** | Pages publiques (smart) | Composent les features |  
| **layout/** | Shell components avec `<router-outlet />` | Navigation + layout |  
| **shared/** | Composants UI réutilisables | Pas de services ici |  
  
### Chemins absolus (aliases)  
  
```typescript  
import { environment } from '@env/environment';  
import { Supabase } from '@core/services/supabase/supabase';  
import { AppointmentList } from '@features/dashboard/pages/dashboard-appointments/dashboard-appointments';  
import { Button } from '@shared/components/button/button';  
```  
  
---  
  
## Clean Architecture  
  
### Principe fondamental  
  
```bash  
UI (pages/components) → Use Cases → Gateways (abstract classes) ← Infra (implémentations)  
```  
  
Le domain ne dépend de RIEN. L'infra dépend du domain. L'UI dépend du domain. Le câblage se fait dans `app.config.ts`.  
  
### Domain — Models  
  
```typescript  
// features/booking/domain/models/appointment.model.ts  
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled';  
  
export type CoachingType = 'life-coaching' | 'personal-development' | 'equine-coaching' | 'neuroatypical-parents';  
  
export type Appointment = {  
  id: string;  clientName: string;  clientEmail: string;  coachingType: CoachingType;  date: string;  time: string;  status: AppointmentStatus;  notes: string;};  
```  
  
Utiliser `type` (pas `interface`) pour les modèles de données.  
  
### Domain — Gateways  
  
```typescript  
// features/booking/domain/gateways/appointment.gateway.ts  
export abstract class AppointmentGateway {  
  abstract getAll(): Observable<Appointment[]>;  abstract getById(id: string): Observable<Appointment>;  abstract create(appointment: Omit<Appointment, 'id'>): Observable<Appointment>;  abstract updateStatus(id: string, status: AppointmentStatus): Observable<Appointment>;  abstract delete(id: string): Observable<void>;}  
```  
  
Utiliser `abstract class` (pas `interface`) — permet l'injection sans `InjectionToken`.  
  
### Domain — Use Cases  
  
```typescript  
// features/booking/domain/use-cases/get-appointments.use-case.ts  
@Injectable({ providedIn: 'root' })  
export class GetAppointmentsUseCase {  
  private readonly gateway = inject(AppointmentGateway);  
  execute(): Observable<Appointment[]> {    return this.gateway.getAll();  }}  
```  
  
Un use case = une opération. Méthode `execute()` par convention.  
  
### Infra — Adapter  
  
```typescript  
// features/booking/infra/adapters/appointment.adapter.ts  
export function toAppointment(raw: SupabaseAppointment): Appointment {  
  return {    id: raw.id,    clientName: raw.client_name,    clientEmail: raw.client_email,    coachingType: raw.coaching_type as CoachingType,    date: raw.appointment_date,    time: raw.appointment_time,    status: raw.status as AppointmentStatus,    notes: raw.notes ?? '',  };}  
```  
  
Fonction pure, testable sans TestBed. Transforme les données API → modèle domain.  
  
### Infra — HTTP Gateway  
  
```typescript  
// features/booking/infra/http-appointment.gateway.ts  
@Injectable()  
export class HttpAppointmentGateway extends AppointmentGateway {  
  private readonly supabase = inject(Supabase);  
  getAll(): Observable<Appointment[]> {    return from(this.supabase.client.from('appointments').select('*')).pipe(      map(({ data }) => (data ?? []).map(toAppointment)),    );  }  
  getById(id: string): Observable<Appointment> {    return from(      this.supabase.client.from('appointments').select('*').eq('id', id).single()    ).pipe(map(({ data }) => toAppointment(data!)));  }  
  create(appointment: Omit<Appointment, 'id'>): Observable<Appointment> {    return from(      this.supabase.client.from('appointments').insert(appointment).select().single()    ).pipe(map(({ data }) => toAppointment(data!)));  }}  
```  
  
### Infra — In-Memory Gateway (pour les tests/dev)  
  
```typescript  
// features/booking/infra/in-memory-appointment.gateway.ts  
@Injectable()  
export class InMemoryAppointmentGateway extends AppointmentGateway {  
  private readonly _appointments = new BehaviorSubject<Appointment[]>(MOCK_APPOINTMENTS);  
  getAll(): Observable<Appointment[]> {    return defer(() => this._appointments.asObservable());  }  
  getById(id: string): Observable<Appointment> {    return defer(() => of(this._appointments.value.find(a => a.id === id)!));  }  
  create(appointment: Omit<Appointment, 'id'>): Observable<Appointment> {    const created = { ...appointment, id: crypto.randomUUID() };    this._appointments.next([...this._appointments.value, created]);    return of(created);  }}  
```  
  
### Câblage — app.config.ts  
  
```typescript  
// UNE SEULE LIGNE à changer pour switcher implémentation  
export const appConfig: ApplicationConfig = {  
  providers: [    provideRouter(routes, withComponentInputBinding()),    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),    provideClientHydration(),    // Switch en une ligne :    { provide: AppointmentGateway, useClass: HttpAppointmentGateway },    // { provide: AppointmentGateway, useClass: InMemoryAppointmentGateway },  ]};  
```  
  
### Smart Component (page) avec Use Case  
  
```typescript  
@Component({  
  selector: 'app-dashboard-appointments',  host: { class: 'block' },  changeDetection: ChangeDetectionStrategy.OnPush,  template: `    <section aria-labelledby="appointments-heading">      <h2 id="appointments-heading">Mes rendez-vous</h2>      @if (appointments(); as list) {        <app-appointment-table [appointments]="list" (statusChanged)="updateStatus($event)" />      } @else {        <app-spinner />      }    </section>  `})  
export class DashboardAppointments {  
  private readonly getAppointments = inject(GetAppointmentsUseCase);  
  protected readonly appointments = toSignal(this.getAppointments.execute());}  
```  
  
---  
  
## Zoneless (priorité absolue)  
  
Angular 21 est zoneless par défaut. Zone.js n'est PLUS utilisé.  
  
### Règles zoneless  
  
- `provideZonelessChangeDetection()` est implicite — ne pas l'ajouter  
- **OnPush obligatoire** sur tous les composants  
- **Signals** pour tout état réactif — le change detection ne s'exécute que quand un signal change  
- NE PAS utiliser `setTimeout`/`setInterval` pour déclencher le change detection  
- NE PAS utiliser `ChangeDetectorRef.detectChanges()` — les signaux gèrent tout  
- `async` pipe fonctionne toujours pour les Observables  
- `toSignal()` convertit Observable → Signal (préféré au `async` pipe)  
  
### Impact sur les tests  
  
```typescript  
// Zoneless : pas de fakeAsync/tick, les signaux sont synchrones  
it('should update count', () => {  
  const fixture = TestBed.createComponent(Counter);  fixture.detectChanges();  
  fixture.componentInstance.increment();  fixture.detectChanges();  
  expect(fixture.nativeElement.textContent).toContain('1');});  
```  
  
---  
  
## TypeScript  
  
- Strict type checking — no implicit `any`  
- Prefer type inference when the type is obvious  
- Use `unknown` when type is uncertain, never `any`  
- Use `type` for data shapes (not `interface`, sauf pour les gateways `abstract class`)  
- Use `readonly` and `const` wherever possible  
- UPPER_SNAKE_CASE for constants: `const MAX_APPOINTMENTS = 50`  
  
---  
  
## Nommage  
  
### Fichiers  
  
- **Tirets** pour séparer les mots : `appointment-card.ts`, `auth-guard.ts`  
- **Pas de suffixes de type** (convention 2025) : pas de `.component.ts`, `.service.ts`, etc.  
- **Tests** : même nom avec `.spec.ts` : `appointment-card.spec.ts`  
- **Templates** : même nom avec `.html` : `appointment-card.html`  
- **Styles** : même nom avec `.scss` : `appointment-card.scss`  
- **Un concept par fichier** — un composant, un service, une directive  
- **Éviter** les noms génériques : `helpers.ts`, `utils.ts`, `common.ts`  
- **Suffixes domain** : `*.model.ts`, `*.gateway.ts`, `*.use-case.ts`, `*.adapter.ts`  
  
### Classes  
  
Le nom doit refléter le comportement et les responsabilités, pas le type.  
  
| Ancien nom | Nouveau nom descriptif |  
| ------------ | ---------------------- |  
| `AppointmentService` | `AppointmentRepository`, `AppointmentStore` |  
| `AuthService` | `AuthManager`, `AuthStore`, `SessionHandler` |  
| `ContactService` | `ContactSender`, `MessageDispatcher` |  
| `ReviewService` | `ReviewRepository`, `ReviewStore` |  
| `NotificationService` | `Notifier`, `ToastManager` |  
| `DashboardComponent` | `Dashboard` |  
| `ContactFormComponent` | `ContactForm` |  
  
### Méthodes  
  
Nommer par l'action, pas par l'événement.  
  
```typescript  
// Recommandé  
submitContact() { }  
confirmAppointment() { }  
cancelSession() { }  
  
// Éviter  
handleClick() { }  
onSubmit() { }  
```  
  
---  
  
## Composants  
  
### Principes fondamentaux  
  
- Standalone par défaut — NE PAS ajouter `standalone: true` (implicite depuis Angular 19)  
- `changeDetection: ChangeDetectionStrategy.OnPush` obligatoire  
- Responsabilité unique : un composant = une responsabilité  
- Préférer les templates inline pour les petits composants  
- Self-closing tags : `<app-component />` (préféré)  
  
### Encapsulation host — réduire le DOM  
  
Les composants Angular génèrent un élément hôte `display: inline` par défaut. **Toujours définir le layout sur le host** via `host: { class }` pour éliminer les `<div>` wrappers inutiles.  
  
```typescript  
// RECOMMANDÉ — layout sur le host, template plat  
@Component({  
  selector: 'app-service-card',  host: { class: 'block p-6 rounded-xl border bg-white shadow-sm' },  template: `    <h3 class="text-xl font-semibold">{{ title() }}</h3>    <p class="mt-2 text-gray-600">{{ description() }}</p>  `})  
  
// ÉVITER — div wrapper qui alourdit le DOM  
@Component({  
  selector: 'app-service-card',  template: `    <div class="block p-6 rounded-xl border bg-white shadow-sm">      <h3>{{ title() }}</h3>      <p>{{ description() }}</p>    </div>  `})  
```  
  
| Cas d'usage | `host: { class: }` |  
| ------------- | --------------------- |  
| Composant block standard | `'block'` |  
| Layout page/section | `'block container mx-auto px-4'` |  
| Composant flex | `'flex flex-col gap-4'` |  
| Composant grid | `'grid grid-cols-2 gap-4'` |  
| Composant transparent | `'contents'` |  
  
**Règle** : si le premier enfant du template est un `<div>` de layout, déplacer ses classes dans `host: { class }` et supprimer le `<div>`.  
  
### Host bindings  
  
NE PAS utiliser `@HostBinding` / `@HostListener`. Utiliser l'objet `host` :  
  
```typescript  
@Component({  
  selector: 'app-cta-button',  host: {    class: 'inline-flex items-center justify-center rounded-lg font-medium',    '[class.opacity-50]': 'disabled()',    '[attr.aria-disabled]': 'disabled()',    '(click)': 'onClick($event)'  }})  
```  
  
### Smart vs Dumb Components  
  
- **Smart (Container/Page)** : injecte les use cases, orchestre, `toSignal()`  
- **Dumb (Presentational)** : `input()` + `output()` uniquement, AUCUN service  
  
### Inputs / Outputs / Model  
  
```typescript  
export class AppointmentCard {  
  appointment = input.required<Appointment>();  showActions = input(true);  statusChanged = output<{ id: string; status: AppointmentStatus }>();  selected = model(false);}  
```  
  
### Queries signal-based  
  
```typescript  
export class Modal {  
  closeButton = viewChild<ElementRef>('closeBtn');  content = viewChild.required<ElementRef>('content');  form = viewChild(FormComponent);  items = viewChildren(ItemComponent);}  
```  
  
### Organisation des propriétés  
  
1. Dépendances injectées (`inject()`)  
2. Inputs / Outputs / Models  
3. Queries (`viewChild`, `contentChild`)  
4. Signals et computed  
5. Méthodes  
  
### Modificateurs d'accès  
  
- `private readonly` pour les dépendances injectées  
- `readonly` pour les inputs  
- `protected` pour les membres utilisés dans le template  
- Préfixer les membres privés avec `_` : `private _data = signal([])`  
  
### Bindings CSS  
  
Préférer `[class]` et `[style]` aux directives NgClass/NgStyle.  
  
```html  
<div [class.active]="isActive()" [class.disabled]="disabled()"></div>  
<div [style.color]="textColor()"></div>  
```  
  
### Images  
  
- `NgOptimizedImage` pour toutes les images statiques  
- `width` + `height` explicites pour éviter le CLS  
- `priority` sur l'image LCP (hero)  
- Format WebP/AVIF préféré  
  
```html  
<img ngSrc="/assets/hero.webp" width="1200" height="630" priority alt="Coaching de vie personnalisé" />  
```  
  
---  
  
## HTML Sémantique & SEO  
  
### Règle d'or  
  
Utiliser les éléments HTML sémantiques au lieu de `<div>`. Améliore SEO, accessibilité, lisibilité.  
  
| Élément HTML | Usage | Au lieu de |  
| ------------- | ------- | ------------ |  
| `<header>` | En-tête de page ou de section | `<div class="header">` |  
| `<nav aria-label="...">` | Navigation | `<div class="nav">` |  
| `<main>` | Contenu principal (unique par page) | `<div class="main">` |  
| `<section aria-labelledby="...">` | Regroupement thématique (avec heading) | `<div class="section">` |  
| `<article>` | Contenu autonome (carte témoignage, offre) | `<div class="card">` |  
| `<aside>` | Contenu complémentaire (sidebar) | `<div class="sidebar">` |  
| `<footer>` | Pied de page | `<div class="footer">` |  
| `<figure>` + `<figcaption>` | Image avec légende | `<div class="image-wrapper">` |  
| `<time datetime="...">` | Dates et heures | `<span>` |  
| `<address>` | Informations de contact | `<div>` |  
| `<button>` | Action interactive | `<div (click)="...">` |  
| `<a routerLink>` | Navigation SPA | `<span (click)="navigate()">` |  
| `<fieldset>` + `<legend>` | Groupe de champs de formulaire | `<div class="form-section">` |  
| `<label for="...">` | Label de champ | `<span class="label">` |  
| `<output>` | Résultat d'un calcul | `<span>` |  
| `<details>` + `<summary>` | FAQ, contenu dépliable | `<div>` + JS custom |  
| `<dialog>` | Modale native | `<div class="modal">` |  
| `<table>` + `<thead>` + `<tbody>` | Données tabulaires (rdv dashboard) | grille CSS de `<div>` |  
| `<dl>` + `<dt>` + `<dd>` | Paires clé-valeur (infos rendez-vous) | `<div>` + `<span>` |  
| `<ol>` / `<ul>` + `<li>` | Listes (services, témoignages) | `<div>` imbriqués |  
| `<blockquote>` + `<cite>` | Témoignage client | `<div class="quote">` |  
  
### Modèle de page sémantique  
  
```html  
<header>  
  <nav aria-label="Navigation principale">    <a routerLink="/" routerLinkActive="font-bold" [routerLinkActiveOptions]="{ exact: true }">Accueil</a>    <a routerLink="/life-coach" routerLinkActive="font-bold">Coaching de vie</a>    <a routerLink="/personal-development" routerLinkActive="font-bold">Développement personnel</a>    <a routerLink="/equine-coaching" routerLinkActive="font-bold">Équicoaching</a>    <a routerLink="/neuroatypical-parents" routerLinkActive="font-bold">Parents neuroatypiques</a>  </nav></header>  
  
<main>  
  <section aria-labelledby="hero-heading">    <h1 id="hero-heading">Transformez votre vie avec un accompagnement sur mesure</h1>    <p>Coach de vie certifiée, je vous accompagne vers votre plein potentiel.</p>  </section>  
  <section aria-labelledby="services-heading">    <h2 id="services-heading">Mes accompagnements</h2>    <article>      <h3>Coaching de vie</h3>      <p>Un accompagnement personnalisé...</p>    </article>  </section>  
  <section aria-labelledby="reviews-heading">    <h2 id="reviews-heading">Témoignages</h2>    <blockquote>      <p>Un accompagnement qui a changé ma vie...</p>      <footer><cite>Marie D.</cite></footer>    </blockquote>  </section>  
  <section aria-labelledby="contact-heading">    <h2 id="contact-heading">Me contacter</h2>    <app-contact-form />  </section></main>  
  
<footer>  
  <nav aria-label="Liens utiles">...</nav>  <address>    <a href="mailto:contact@coaching-life.fr">contact@coaching-life.fr</a>  </address>  <p><small>&copy; 2026 Coaching Life</small></p></footer>  
```  
  
### Hiérarchie des headings  
  
- **Un seul `<h1>` par page**  
- **Ne jamais sauter de niveau** : h1 → h2 → h3 (pas h1 → h3)  
- Chaque `<section>` doit avoir un heading (`aria-labelledby`)  
  
### SEO technique  
  
```typescript  
export class LifeCoach {  
  private readonly title = inject(Title);  private readonly meta = inject(Meta);  
  constructor() {    this.title.setTitle('Coaching de vie — Coaching Life');    this.meta.updateTag({ name: 'description', content: 'Accompagnement personnalisé en coaching de vie.' });  }}  
```  
  
- `routerLink` pour toute navigation interne (crawlable)  
- Texte descriptif pour les liens (jamais "cliquez ici")  
- `alt` descriptif sur toutes les images (`alt=""` seulement pour décoratives)  
- Preconnect : `<link rel="preconnect" href="https://your-project.supabase.co" />`  
- **SSR** activé — Angular SSR pré-rend les pages publiques pour le crawling  
  
### Structured Data (JSON-LD)  
  
```html  
<script type="application/ld+json">  
{  
  "@context": "https://schema.org",  "@type": "ProfessionalService",  "name": "Coaching Life",  "description": "Coach de vie certifiée - Accompagnement personnalisé",  "serviceType": ["Life Coaching", "Personal Development", "Equine Coaching"],  "areaServed": { "@type": "Country", "name": "France" }}  
</script>  
```  
  
---  
  
## Templates  
  
### Control Flow moderne (obligatoire)  
  
`@if`, `@for`, `@switch` — NE PAS utiliser `*ngIf`, `*ngFor`, `*ngSwitch`.  
  
```html  
@if (isLoading()) {  
  <app-spinner />} @else if (error()) {  
  <app-error [message]="error()" />} @else {  
  <app-content [data]="data()" />}  
  
@for (item of items(); track item.id) {  
  <app-item [item]="item" />} @empty {  
  <p>Aucun élément</p>}  
  
@switch (status()) {  
  @case ('loading') { <app-spinner /> }  @case ('error') { <app-error /> }  @default { <app-content /> }}  
```  
  
Variables `@for` : `$index`, `$first`, `$last`, `$even`, `$odd`, `$count`.  
  
`track` obligatoire avec identifiant stable (`item.id`) — JAMAIS `$index` sur liste mutable.  
  
### @defer — Lazy loading de composants  
  
```html  
@defer (on viewport) {  
  <app-reviews />} @placeholder {  
  <div class="h-64 animate-pulse bg-gray-200 rounded"></div>} @loading (minimum 300ms) {  
  <app-spinner />} @error {  
  <p>Erreur de chargement</p>}  
  
@defer (on hover; prefetch on idle) {  
  <app-booking-preview [appointment]="appointment()" />} @placeholder {  
  <span>Survoler pour aperçu</span>}  
```  
  
Triggers : `on viewport`, `on hover`, `on interaction`, `on timer(ms)`, `on idle`, `when condition()`.  
  
### Template literals (Angular 20+)  
  
```html  
<p>{{ `Bonjour ${user().name}!` }}</p>  
<div [class]="`status-${status()}`"></div>  
```  
  
### @let (variables locales)  
  
```html  
@let appointmentList = appointments();  
@if (appointmentList) {  
  <app-appointment-table [appointments]="appointmentList" />} @else {  
  <p>Chargement...</p>}  
```  
  
---  
  
## Signals & Réactivité  
  
### API principale  
  
```typescript  
// State mutable  
count = signal(0);  
count.set(5);  
count.update(n => n + 1);  
  
// Valeur dérivée (read-only, auto-recalculée)  
doubleCount = computed(() => this.count() * 2);  
  
// Side effects (utiliser avec parcimonie)  
constructor() {  
  effect(() => console.log('Count:', this.count()));}  
  
// État dérivé modifiable  
selectedItem = linkedSignal(() =>  
  this.items().find(i => i.id === this.selectedId()));  
```  
  
### Règles des Signals  
  
- `set()` ou `update()` — NE PAS utiliser `mutate`  
- Toujours nouvelles références : `[...array, item]`, `new Map(old)`  
- Encapsuler : `private _data = signal([]); data = this._data.asReadonly()`  
- Ne pas modifier les signaux lus dans un `effect()` (boucle infinie)  
- Utiliser `computed()` dans les templates — JAMAIS de méthodes/getters  
  
### Signals ↔ RxJS (interopérabilité)  
  
```typescript  
// Observable → Signal  
protected readonly appointments = toSignal(this.getAppointments.execute(), { initialValue: [] });  
  
// Signal → Observable (quand on a besoin d'opérateurs RxJS)  
private readonly search$ = toObservable(this.searchTerm);  
```  
  
### Pattern Sandwich : Signal → RxJS → Signal  
  
```typescript  
protected readonly searchTerm = signal('');  
  
private readonly results$ = toObservable(this.searchTerm).pipe(  
  debounceTime(300),  filter(term => term.length >= 3),  distinctUntilChanged(),  switchMap(term => this.http.get<Result[]>(`/api/search?q=${term}`)),);  
  
protected readonly results = toSignal(this.results$, { initialValue: [] });  
```  
  
### Quand utiliser quoi  
  
| Besoin | Utiliser |  
| -------- | --------- |  
| État local UI | `signal()` + `computed()` |  
| Valeur dérivée | `computed()` |  
| État dérivé modifiable | `linkedSignal()` |  
| Appel HTTP simple | `httpResource()` ou `toSignal(http.get(...))` |  
| Flux temps réel / debounce / retry | RxJS + `toSignal()` |  
| Service partagé (store) | `BehaviorSubject` + `asObservable()` côté service, `toSignal()` côté composant |  
  
### Resource API (chargement asynchrone avec état)  
  
```typescript  
// httpResource — le plus simple pour GET  
protected readonly appointment = httpResource<Appointment>(() =>  
  this.appointmentId()    ? `/api/appointments/${this.appointmentId()}`    : undefined);  
  
// Template  
@if (appointment.isLoading()) {  
  <app-spinner />} @else if (appointment.error()) {  
  <p>Erreur</p>} @else if (appointment.value(); as a) {  
  <h2>{{ a.clientName }}</h2>}  
  
// rxResource — quand on utilise HttpClient/Observable  
protected readonly appointments = rxResource({  
  params: () => ({ status: this.filterStatus() }),  stream: ({ params }) => () =>    this.appointmentGateway.getByStatus(params.status),});  
  
// resource — quand on utilise fetch/Promise  
protected readonly data = resource({  
  params: () => ({ id: this.selectedId() }),  loader: ({ params }) => fetch(`/api/data/${params.id}`).then(r => r.json()),});  
```  
  
### RxJS — opérateurs essentiels  
  
| Opérateur | Rôle | Usage |  
| ----------- | ------ | ------- |  
| `map` | Transformer | Adapter réponse API |  
| `switchMap` | Annuler précédent | Recherche temps réel |  
| `mergeMap` | Paralléliser | Requêtes bulk |  
| `exhaustMap` | Ignorer si occupé | Anti-spam submit |  
| `filter` | Filtrer | Validation |  
| `debounceTime` | Attendre | Input utilisateur |  
| `distinctUntilChanged` | Dédoublonner | Éviter re-fetch |  
| `combineLatest` | Combiner (continu) | Vue combinée |  
| `forkJoin` | Attendre tous (once) | Requêtes parallèles |  
| `withLatestFrom` | Action + contexte | Submit + form value |  
| `catchError` | Récupérer erreur | Fallback |  
| `shareReplay(1)` | Cache + partage | HTTP cache |  
| `takeUntilDestroyed()` | Auto-unsubscribe | Tout subscribe manuel |  
| `tap` | Side effect sans modifier | Logging/debug |  
  
### Ordre des opérateurs de filtrage (critique)  
  
```typescript  
// CORRECT : debounce → trim → filter → distinct  
searchControl.valueChanges.pipe(  
  debounceTime(300),  map(v => v.trim()),  filter(v => v.length >= 3),  distinctUntilChanged(),  switchMap(term => this.search(term)),);  
```  
  
---  
  
## Formulaires  
  
### Reactive Forms typés avec HTML sémantique  
  
Toujours `<fieldset>` + `<legend>` pour grouper. Toujours `<label for="id">`.  
  
```typescript  
type ContactInfoForm = {  
  name: FormControl<string>;  email: FormControl<string>;  phone: FormControl<string>;};  
  
type ContactFormShape = {  
  contactInfo: FormGroup<ContactInfoForm>;  subject: FormControl<string>;  message: FormControl<string>;};  
  
@Component({  
  host: { class: 'block max-w-2xl mx-auto p-6' },  changeDetection: ChangeDetectionStrategy.OnPush,  template: `    <form [formGroup]="form" (ngSubmit)="submitContact()">      <fieldset formGroupName="contactInfo">        <legend>Vos coordonnées</legend>  
        <label for="name">Nom complet <span aria-hidden="true">*</span></label>        <input id="name" type="text" formControlName="name"               aria-required="true" autocomplete="name" />        @if (form.controls.contactInfo.controls.name.touched          && form.controls.contactInfo.controls.name.errors?.['required']) {          <small role="alert">Le nom est obligatoire.</small>        }  
        <label for="email">Email <span aria-hidden="true">*</span></label>        <input id="email" type="email" formControlName="email"               aria-required="true" autocomplete="email" />        @if (form.controls.contactInfo.controls.email.touched) {          @if (form.controls.contactInfo.controls.email.errors?.['required']) {            <small role="alert">L'email est obligatoire.</small>          } @else if (form.controls.contactInfo.controls.email.errors?.['email']) {            <small role="alert">Format email invalide.</small>          }        }  
        <label for="phone">Téléphone</label>        <input id="phone" type="tel" formControlName="phone" autocomplete="tel" />      </fieldset>  
      <fieldset>        <legend>Votre message</legend>  
        <label for="subject">Sujet <span aria-hidden="true">*</span></label>        <select id="subject" formControlName="subject" aria-required="true">          <option value="">-- Choisir un sujet --</option>          <option value="life-coaching">Coaching de vie</option>          <option value="personal-development">Développement personnel</option>          <option value="equine-coaching">Équicoaching</option>          <option value="neuroatypical-parents">Parents neuroatypiques</option>          <option value="other">Autre</option>        </select>  
        <label for="message">Message <span aria-hidden="true">*</span></label>        <textarea id="message" formControlName="message" rows="5"                  aria-required="true"></textarea>      </fieldset>  
      <footer class="flex gap-4 mt-6">        <button type="submit" [disabled]="form.invalid">Envoyer</button>        <button type="button" [disabled]="form.pristine" (click)="resetForm()">          Réinitialiser        </button>      </footer>    </form>  `})  
```  
  
### Modèles HTML de champs  
  
```html  
<!-- Texte -->  
<label for="name">Nom <span aria-hidden="true">*</span></label>  
<input id="name" type="text" formControlName="name" aria-required="true" />  
  
<!-- Email / Tel -->  
<input id="email" type="email" formControlName="email" autocomplete="email" />  
<input id="phone" type="tel" formControlName="phone" autocomplete="tel" />  
  
<!-- Date / Heure -->  
<input id="date" type="date" formControlName="appointmentDate" [min]="today" />  
<input id="time" type="time" formControlName="appointmentTime" />  
  
<!-- Select -->  
<select id="coaching" formControlName="coachingType">  
  <option value="">-- Sélectionner --</option>  @for (type of coachingTypes; track type.value) {    <option [value]="type.value">{{ type.label }}</option>  }</select>  
  
<!-- Radios dans un fieldset -->  
<fieldset>  
  <legend>Préférence de contact</legend>  <label><input type="radio" formControlName="contactPref" value="email" /> Par email</label>  <label><input type="radio" formControlName="contactPref" value="phone" /> Par téléphone</label></fieldset>  
  
<!-- Checkbox -->  
<label><input type="checkbox" formControlName="acceptTerms" /> J'accepte les conditions</label>  
  
<!-- Textarea -->  
<textarea id="notes" formControlName="notes" rows="4"></textarea>  
  
<!-- Code postal (text, pas number — préserve les 0) -->  
<input id="postalCode" type="text" formControlName="postalCode" inputmode="numeric" pattern="[0-9]{5}" />  
```  
  
### Formulaire progressif (cascade enable/disable)  
  
```typescript  
constructor() {  
  this.form.controls.details.disable();  this.form.controls.confirmation.disable();  
  const infoStatus = toSignal(this.form.controls.contactInfo.statusChanges);  effect(() => {    if (infoStatus() === 'VALID') {      this.form.controls.details.enable();    } else {      this.form.controls.details.disable();      this.form.controls.confirmation.disable();    }  });  
  const detailsStatus = toSignal(this.form.controls.details.statusChanges);  effect(() => {    if (detailsStatus() === 'VALID') {      this.form.controls.confirmation.enable();    } else {      this.form.controls.confirmation.disable();    }  });}  
```  
  
```html  
<form [formGroup]="form" (ngSubmit)="submit()">  
  <fieldset formGroupName="contactInfo">  
    <legend>1. Vos coordonnées</legend>  
  </fieldset>  
  
  @if (form.controls.details.enabled) {    <fieldset formGroupName="details">  
      <legend>2. Détails du rendez-vous</legend>  
    </fieldset>  
  }  
  @if (form.controls.confirmation.enabled) {    <fieldset formGroupName="confirmation">  
      <legend>3. Confirmation</legend>  
    </fieldset>  
  }  
  <button type="submit" [disabled]="form.invalid">Confirmer</button>  
</form>  
```  
  
### Champs conditionnels (enable/disable dynamique)  
  
```typescript  
const contactPref = toSignal(this.form.controls.contactInfo.controls.contactPreference.valueChanges);  
  
effect(() => {  
  const pref = contactPref();  if (pref === 'email') {    this.form.controls.contactInfo.controls.email.enable();    this.form.controls.contactInfo.controls.phone.disable();  } else if (pref === 'phone') {    this.form.controls.contactInfo.controls.phone.enable();    this.form.controls.contactInfo.controls.email.disable();  }});  
```  
  
### Validators personnalisés  
  
```typescript  
// Simple  
function forbiddenValues(forbidden: string[]): ValidatorFn {  
  return (control: AbstractControl) =>    forbidden.includes(control.value) ? { forbidden: { value: control.value } } : null;}  
  
// Date minimum dynamique  
function dateMin(minDateFn: () => string): ValidatorFn {  
  return (control: AbstractControl) => {    if (!control.value) return null;    return new Date(control.value) < new Date(minDateFn())      ? { dateMin: { min: minDateFn(), actual: control.value } }      : null;  };}  
  
// Cross-field — au moins un moyen de contact  
function atLeastOneContact(group: AbstractControl): ValidationErrors | null {  
  const email = group.get('email')?.value;  const phone = group.get('phone')?.value;  return email || phone ? null : { atLeastOneContact: true };}  
  
// Utilisation sur FormGroup  
contactInfo: new FormGroup<ContactInfoForm>({ ... }, { validators: [atLeastOneContact] })  
```  
  
### Modification dynamique de validators  
  
```typescript  
control.clearValidators();  
control.addValidators([Validators.required, dateMin(() => this.tomorrow)]);  
control.updateValueAndValidity(); // OBLIGATOIRE après changement  
```  
  
### Règles formulaires  
  
- Toujours typer les FormGroups  
- `nonNullable: true` sur tous les contrôles  
- `getRawValue()` (pas `value`) pour inclure les champs disabled  
- `patchValue()` partiel, `setValue()` complet  
- `reset()` remet valeurs initiales + `pristine` + `untouched`, ne change PAS enabled/disabled  
- Après `reset()`, re-disable manuellement les sections qui doivent l'être  
  
---  
  
## Services & Injection de dépendances  
  
### Règles des services  
  
- Utiliser `inject()` — NE PAS utiliser l'injection par constructeur  
- `@Injectable({ providedIn: 'root' })` pour les singletons  
- Responsabilité unique  
- Pattern Façade : cacher la complexité derrière une interface simple  
- Exposer les données via des signaux read-only  
  
```typescript  
@Injectable({ providedIn: 'root' })  
export class AppointmentStore {  
  private readonly supabase = inject(Supabase);  
  private readonly _appointments = signal<Appointment[]>([]);  readonly appointments = this._appointments.asReadonly();  
  async findAll() {    const { data } = await this.supabase.client      .from('appointments')      .select('*')      .order('appointment_date', { ascending: true });    if (data) this._appointments.set(data.map(toAppointment));  }}  
```  
  
---  
  
## Routing  
  
### Configuration complète  
  
```typescript  
// app.routes.ts  
export const routes: Routes = [  
  // Pages publiques (MainLayout)  {    path: '',    component: MainLayout,    children: [      { path: '', component: Home, pathMatch: 'full' },      { path: 'life-coach', loadComponent: () => import('./pages/life-coach/life-coach').then(m => m.LifeCoach) },      { path: 'personal-development', loadComponent: () => import('./pages/personal-development/personal-development').then(m => m.PersonalDevelopment) },      { path: 'equine-coaching', loadComponent: () => import('./pages/equine-coaching/equine-coaching').then(m => m.EquineCoaching) },      { path: 'neuroatypical-parents', loadComponent: () => import('./pages/neuroatypical-parents/neuroatypical-parents').then(m => m.NeuroatypicalParents) },    ],  },  
  // Dashboard protégé (DashboardLayout)  {    path: 'dashboard',    component: DashboardLayout,    canMatch: [authGuard],    loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES),  },  
  // Auth  {    path: 'auth',    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),  },  
  // Wildcard — toujours en dernier  {    path: '**',    loadComponent: () => import('./pages/not-found/not-found').then(m => m.NotFound),  },];  
```  
  
### Feature routes (dashboard)  
  
```typescript  
// features/dashboard/dashboard.routes.ts  
export const DASHBOARD_ROUTES: Routes = [  
  { path: '', component: DashboardHome },  {    path: 'appointments',    loadComponent: () => import('./pages/dashboard-appointments/dashboard-appointments').then(m => m.DashboardAppointments),  },  {    path: 'appointments/:id',    loadComponent: () => import('./pages/appointment-detail/appointment-detail').then(m => m.AppointmentDetail),    resolve: { appointment: appointmentResolver },  },  {    path: 'messages',    loadComponent: () => import('./pages/dashboard-messages/dashboard-messages').then(m => m.DashboardMessages),  },];  
```  
  
### App Config complet  
  
```typescript  
export const appConfig: ApplicationConfig = {  
  providers: [    provideRouter(      routes,      withComponentInputBinding(),      withViewTransitions(),      withInMemoryScrolling({        anchorScrolling: 'enabled',        scrollPositionRestoration: 'enabled',      }),    ),    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),    provideClientHydration(),    { provide: AppointmentGateway, useClass: HttpAppointmentGateway },  ]};  
```  
  
### Route params via input()  
  
```typescript  
export class AppointmentDetail {  
  readonly id = input.required<string>();     // :id  readonly sort = input<string>('');          // ?sort=date}  
```  
  
### Resolver  
  
```typescript  
export const appointmentResolver: ResolveFn<Appointment | null> = (route) => {  
  const gateway = inject(AppointmentGateway);  const router = inject(Router);  const id = route.paramMap.get('id')!;  
  return gateway.getById(id).pipe(    catchError(() => {      router.navigate(['/dashboard/appointments']);      return EMPTY;    }),  );};  
```  
  
### Guards fonctionnels  
  
```typescript  
// CanMatch — préféré  
export const authGuard: CanMatchFn = () => {  
  const auth = inject(AuthStore);  const router = inject(Router);  return auth.isAuthenticated() ? true : router.createUrlTree(['/auth/login']);};  
  
// CanDeactivate — confirmation avant de quitter un formulaire  
export const confirmExitGuard: CanDeactivateFn<{ isDirty(): boolean }> = (component) => {  
  return component.isDirty() ? confirm('Modifications non sauvegardées. Quitter ?') : true;};  
```  
  
### Navigation programmatique  
  
```typescript  
private readonly router = inject(Router);  
  
this.router.navigate(['/dashboard/appointments', appointment.id]);  
  
this.router.navigate(['/dashboard/appointments'], {  
  queryParams: { status: 'confirmed' },});  
  
this.router.navigate([], {  
  queryParams: { sort: newSort },  queryParamsHandling: 'merge',});  
```  
  
### routerLink  
  
```html  
<a routerLink="/life-coach" routerLinkActive="font-bold">Coaching de vie</a>  
<a [routerLink]="['/dashboard/appointments', appointment.id]">Détail</a>  
<a routerLink="/" routerLinkActive="font-bold" [routerLinkActiveOptions]="{ exact: true }">Accueil</a>  
```  
  
### Intercepteur fonctionnel  
  
```typescript  
export const authInterceptor: HttpInterceptorFn = (req, next) => {  
  const token = inject(AuthStore).token();  if (token) {    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });  }  return next(req);};  
```  
  
---  
  
## Performance  
  
- **Host `class`** pour éliminer les `<div>` wrappers  
- **OnPush + Signals** — change detection uniquement sur changement de signal  
- **Lazy loading** — toutes les features via `loadChildren`/`loadComponent`  
- **`@defer`** — composants lourds hors viewport (témoignages, calendrier)  
- **`computed()`** dans les templates — JAMAIS de méthodes/getters  
- **`track item.id`** — identifiant stable, jamais `$index` sur liste mutable  
- Éviter les barrel imports (`index.ts`) — empêchent le tree-shaking  
- Virtual scrolling (`CdkVirtualScrollViewport`) pour les listes > 100 éléments  
- **SSR** pour le pré-rendu des pages publiques (FCP/LCP optimisés)  
- `NgOptimizedImage` avec `priority` sur le hero  
  
---  
  
## Accessibilité (a11y)  
  
- Doit passer tous les checks AXE  
- Respecter tous les minimums WCAG AA  
- HTML sémantique obligatoire  
- `<button>` pour les actions, `<a>` pour la navigation — jamais `<div (click)>`  
- `aria-label` ou `aria-labelledby` sur `<nav>`, `<section>`, éléments sans texte visible  
- `aria-required="true"` sur les champs obligatoires  
- `role="alert"` sur les messages d'erreur de formulaire  
- `focus-visible` plutôt que `focus` pour les styles  
- Navigation clavier complète : Tab, Enter, Escape, Arrow keys  
  
---  
  
## Tests avec Vitest  
  
### Tester par couche  
  
| Couche | Quoi tester | TestBed ? | Mock |  
| -------- | ------------ | ----------- | ------ |  
| **Domain** (use case, validator, adapter) | Logique pure | Non | Stubs simples |  
| **Infra** (HTTP gateway) | Requêtes HTTP | Oui | `HttpTestingController` |  
| **Composant** (unit) | Classe + template | Oui | Gateways mockés |  
| **Intégration** | Workflow complet | Oui | Seulement HTTP |  
  
### Test du domain (sans TestBed)  
  
```typescript  
describe('toAppointment', () => {  
  it('should transform Supabase row to domain model', () => {    const raw = { id: '1', client_name: 'Marie', client_email: 'marie@test.fr', coaching_type: 'life-coaching', appointment_date: '2026-03-01', appointment_time: '10:00', status: 'confirmed', notes: null };    expect(toAppointment(raw)).toEqual({      id: '1', clientName: 'Marie', clientEmail: 'marie@test.fr', coachingType: 'life-coaching', date: '2026-03-01', time: '10:00', status: 'confirmed', notes: '',    });  });});  
```  
  
### Test d'un composant  
  
```typescript  
describe('DashboardAppointments', () => {  
  it('should display appointments', () => {    const mock = AppointmentBuilder.buildMany(3);    const fixture = TestBed.overrideComponent(DashboardAppointments, {      set: {        providers: [          { provide: GetAppointmentsUseCase, useValue: { execute: () => of(mock) } },        ],      },    }).createComponent(DashboardAppointments);  
    fixture.detectChanges();  
    expect(fixture.nativeElement.querySelectorAll('[data-testid="appointment-item"]').length).toBe(3);  });});  
```  
  
### Test HTTP (gateway infra)  
  
```typescript  
describe('HttpAppointmentGateway', () => {  
  let gateway: HttpAppointmentGateway;  let httpController: HttpTestingController;  
  beforeEach(() => {    TestBed.configureTestingModule({      providers: [HttpAppointmentGateway, provideHttpClient(), provideHttpClientTesting()],    });    gateway = TestBed.inject(HttpAppointmentGateway);    httpController = TestBed.inject(HttpTestingController);  });  
  afterEach(() => httpController.verify());  
  it('should GET all appointments', async () => {    const expected = [{ id: '1', client_name: 'Marie', status: 'confirmed' }];    const resultPromise = firstValueFrom(gateway.getAll());    httpController.expectOne({ method: 'GET' }).flush(expected);    const result = await resultPromise;    expect(result).toHaveLength(1);    expect(result[0].clientName).toBe('Marie');  });});  
```  
  
### Test d'intégration  
  
```typescript  
describe('DashboardAppointments integration', () => {  
  let fixture: ComponentFixture<DashboardAppointments>;  let httpController: HttpTestingController;  
  beforeEach(() => {    TestBed.configureTestingModule({      providers: [        provideHttpClient(), provideHttpClientTesting(),        { provide: AppointmentGateway, useClass: HttpAppointmentGateway },      ],    });    fixture = TestBed.createComponent(DashboardAppointments);    httpController = TestBed.inject(HttpTestingController);  });  
  afterEach(() => httpController.verify());  
  it('should load and display appointments from API', async () => {    fixture.detectChanges();    httpController.expectOne('/api/appointments').flush([      { id: '1', client_name: 'Marie', status: 'confirmed' },    ]);    await fixture.whenStable();    fixture.detectChanges();    expect(fixture.nativeElement.querySelectorAll('[data-testid="appointment-item"]').length).toBe(1);  });});  
```  
  
### Test routing  
  
```typescript  
it('should navigate to appointment detail', async () => {  
  const harness = await RouterTestingHarness.create();  const component = await harness.navigateByUrl('/dashboard/appointments/1', AppointmentDetail);  harness.detectChanges();  expect(component).toBeInstanceOf(AppointmentDetail);  expect(component.id()).toBe('1');});  
```  
  
### Pattern Builder  
  
```typescript  
export class AppointmentBuilder {  
  private entity: Appointment = {    id: '1', clientName: 'Marie', clientEmail: 'marie@test.fr',    coachingType: 'life-coaching', date: '2026-03-01', time: '10:00',    status: 'pending', notes: '',  };  
  static default() { return new AppointmentBuilder(); }  
  with<K extends keyof Appointment>(key: K, value: Appointment[K]) {    this.entity[key] = value;    return this;  }  
  build(): Appointment { return { ...this.entity }; }  
  static buildMany(count: number): Appointment[] {    return Array.from({ length: count }, (_, i) =>      this.default().with('id', String(i + 1)).build()    );  }}  
```  
  
### Pattern PageModel  
  
```typescript  
class AppointmentListPage {  
  constructor(private fixture: ComponentFixture<DashboardAppointments>) {}  
  get items() { return this.fixture.nativeElement.querySelectorAll('[data-testid="appointment-item"]'); }  get itemCount() { return this.items.length; }  
  clickItem(index: number) {    this.items[index].click();    this.fixture.detectChanges();  }}  
```  
  
### Règles de test  
  
- Pattern AAA : Given / When / Then  
- `data-testid` pour les sélecteurs stables  
- `fixture.detectChanges()` après chaque action  
- `await fixture.whenStable()` pour les async  
- `firstValueFrom()` pour tester les Observables  
- `vi.fn()` pour les stubs, `vi.spyOn()` pour les espions  
- Pas de `fakeAsync`/`tick` — zoneless, signaux synchrones  
  
---  
  
## TailwindCSS v4  
  
```html  
<button class="px-4 py-2 bg-brand-600 text-white rounded-lg  
               hover:bg-brand-700               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500               disabled:opacity-50 disabled:cursor-not-allowed">  Réserver une séance</button>  
```  
  
Utiliser `focus-visible` (pas `focus`) pour le style de focus clavier.  
  
---  
  
## Pièges courants  
  
| Problème | Solution |  
| ---------- | ---------- |  
| Propriété privée dans le template | `protected` (templates sont "hors" de la classe) |  
| Signal non détecté | Nouvelle référence : `set([...])` pas `array.push()` |  
| Boucle infinie `effect()` | Ne pas modifier les signaux lus dans l'effect |  
| FormGroup toujours invalide | Vérifier tous les champs requis |  
| Routes dans le mauvais ordre | Spécifiques avant wildcard `**` |  
| Champs disabled non soumis | `getRawValue()` au lieu de `value` |  
| Effect init avec `undefined` | Vérifier `=== false` (pas falsy) |  
| Layout cassé par host element | `host: { class: 'block' }` |  
| Div wrapper inutile | Déplacer dans `host: { class }` |  
| Méthode/getter dans template | Remplacer par `computed()` |  
| CLS images | `width` + `height` + `priority` sur LCP |  
| `track $index` liste mutable | `track item.id` |  
| `<div (click)>` | `<button>` natif (clavier + a11y) |  
| Bundle trop gros | Lazy load + `@defer` + pas de barrel imports |  
| Zone.js utilisé | Supprimer — zoneless est le défaut Angular 21 |  
| `ChangeDetectorRef.detectChanges()` | Utiliser des signaux — pas besoin |  
| `setTimeout` pour trigger CD | Utiliser des signaux — pas besoin |  
| Subscriber non nettoyé | `takeUntilDestroyed()` ou `toSignal()` |  
| `form.value` exclut disabled | `form.getRawValue()` |  
| Validators changés sans effet | `control.updateValueAndValidity()` après |  
  
---  
  
## Commandes utiles  
  
```bash  
pnpm start               # Serveur de dev  
pnpm build               # Build production  
pnpm test                # Tests Vitest  
pnpm ng generate         # Générateur Angular CLI  
pnpm serve:ssr:coaching-life  # Serveur SSR  
```  
  
---  
  
## Ressources  
  
- [Angular Documentation](https://angular.dev)  
- [Angular Style Guide](https://angular.dev/style-guide)  
- [Angular AI Resources](https://angular.dev/ai)  
- [RFC Style Guide 2025](https://github.com/angular/angular/discussions/59522)  
- [Supabase Documentation](https://supabase.com/docs)  
- [TailwindCSS v4](https://tailwindcss.com/docs)