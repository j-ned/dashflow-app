# HttpClient Angular — Reference

## Setup

```typescript
// app.config.ts
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(
      withFetch(),                                    // recommande pour SSR
      // withInterceptors([authInterceptor, loggingInterceptor]),
    ),
  ],
};
```

- `withFetch()` — utilise `fetch()` au lieu de `XMLHttpRequest`, recommande pour SSR et les nouvelles apps
- `withInterceptors([...])` — interceptors fonctionnels (voir section dediee)

## Requetes

```typescript
private readonly http = inject(HttpClient);

// GET
this.http.get<User[]>('/api/users').subscribe(users => {
  console.log(users);
});

// POST
this.http.post<User>('/api/users', newUser).subscribe(created => {
  console.log('Created:', created.id);
});

// PUT
this.http.put<User>('/api/users/1', updatedUser).subscribe(updated => {
  console.log('Updated:', updated.name);
});

// PATCH
this.http.patch<User>('/api/users/1', { name: 'New name' }).subscribe();

// DELETE
this.http.delete('/api/users/1').subscribe(() => {
  console.log('Deleted');
});
```

## Options

```typescript
this.http.get<Data>('/api/data', {
  // Query params
  params: { filter: 'all', page: '1' },
  // Ou avec HttpParams :
  // params: new HttpParams().set('filter', 'all').set('page', '1'),

  // Headers
  headers: { 'X-Custom-Header': 'value' },
  // Ou avec HttpHeaders :
  // headers: new HttpHeaders().set('X-Custom-Header', 'value'),

  // Type de reponse
  responseType: 'json',   // 'json' | 'text' | 'arraybuffer' | 'blob'

  // Observer
  observe: 'body',        // 'body' | 'response' | 'events'

  // Timeout
  timeout: 3000,          // en millisecondes

  // Transfert de cache (SSR)
  transferCache: true,    // ou { includeHeaders: ['X-Custom'] }
});
```

## Response complete

```typescript
this.http.get<Config>('/api/config', { observe: 'response' }).subscribe(res => {
  console.log('Status:', res.status);          // 200
  console.log('Headers:', res.headers);        // HttpHeaders
  console.log('Body:', res.body);              // Config
  console.log('URL:', res.url);                // URL finale (apres redirects)
});
```

## Upload avec progression

```typescript
const formData = new FormData();
formData.append('file', file);

this.http.post('/api/upload', formData, {
  reportProgress: true,
  observe: 'events',
}).subscribe(event => {
  switch (event.type) {
    case HttpEventType.UploadProgress:
      if (event.total) {
        const percent = Math.round((event.loaded / event.total) * 100);
        console.log(`Upload: ${percent}%`);
      }
      break;
    case HttpEventType.Response:
      console.log('Upload complete:', event.body);
      break;
  }
});
```

## Gestion d'erreurs

```typescript
import { catchError, retry, throwError } from 'rxjs';

this.http.get<Data>('/api/data').pipe(
  retry(3),                    // retenter 3 fois avant d'echouer
  catchError((err: HttpErrorResponse) => {
    if (err.status === 0) {
      // Erreur reseau (pas de connexion, CORS, etc.)
      console.error('Network error:', err.message);
    } else {
      // Erreur backend
      console.error(`Backend error ${err.status}:`, err.error);
    }
    return throwError(() => err);
  }),
);
```

### Retry avec delai

```typescript
import { retry, timer } from 'rxjs';

this.http.get('/api/data').pipe(
  retry({
    count: 3,
    delay: (error, retryCount) => {
      if (error.status === 503) {
        return timer(retryCount * 1000); // backoff lineaire
      }
      return throwError(() => error);    // ne pas retenter les 4xx
    },
  }),
);
```

## Options fetch avancees (avec withFetch())

```typescript
this.http.get('/api/data', {
  context: new HttpContext()
    .set(FETCH_KEEPALIVE, true)       // requete survit a la fermeture de la page
    .set(FETCH_CACHE, 'force-cache')  // 'force-cache' | 'no-cache' | 'only-if-cached'
    .set(FETCH_PRIORITY, 'high')      // 'high' | 'low' | 'auto'
    .set(FETCH_CREDENTIALS, 'include'), // 'include' | 'same-origin' | 'omit'
});
```

## Interceptors fonctionnels (recommandes)

```typescript
import { HttpRequest, HttpHandlerFn, HttpEventType } from '@angular/common/http';

// Auth interceptor
export function authInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const token = inject(AuthService).getAuthToken();
  if (token) {
    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`),
    });
    return next(authReq);
  }
  return next(req);
}

// Logging interceptor
export function loggingInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const started = Date.now();
  return next(req).pipe(
    tap(event => {
      if (event.type === HttpEventType.Response) {
        const elapsed = Date.now() - started;
        console.log(`${req.method} ${req.url} → ${event.status} (${elapsed}ms)`);
      }
    }),
  );
}

// Error interceptor
export function errorInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        inject(Router).navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
}
```

### Enregistrement

```typescript
// app.config.ts
provideHttpClient(
  withFetch(),
  withInterceptors([authInterceptor, loggingInterceptor, errorInterceptor]),
)
```

- L'ordre compte : les interceptors sont executes dans l'ordre pour la requete, dans l'ordre inverse pour la reponse

### HttpContext pour metadata

```typescript
// Definir un token de contexte
export const CACHING_ENABLED = new HttpContextToken<boolean>(() => true);
export const RETRY_COUNT = new HttpContextToken<number>(() => 3);
```

```typescript
// Dans l'interceptor
export function cachingInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  if (!req.context.get(CACHING_ENABLED)) {
    return next(req);
  }
  // ... logique de cache
  return next(req);
}
```

```typescript
// A l'appel
this.http.get('/api/data', {
  context: new HttpContext()
    .set(CACHING_ENABLED, false)
    .set(RETRY_COUNT, 5),
});
```

## XSRF / CSRF

```typescript
provideHttpClient(
  withXsrfConfiguration({
    cookieName: 'XSRF-TOKEN',    // defaut
    headerName: 'X-XSRF-TOKEN',  // defaut
  }),
)
```

## Testing

```typescript
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

// Setup
TestBed.configureTestingModule({
  providers: [
    provideHttpClient(),
    provideHttpClientTesting(),
    MyService,
  ],
});

const httpController = TestBed.inject(HttpTestingController);
const service = TestBed.inject(MyService);

// Test
service.getUsers().subscribe(users => {
  expect(users).toHaveLength(2);
});

const req = httpController.expectOne('/api/users');
expect(req.request.method).toBe('GET');
req.flush([{ id: 1 }, { id: 2 }]);

// Verification
httpController.verify(); // aucune requete en attente
```

### Matcher avance

```typescript
// Par methode et URL
httpController.expectOne(req => req.method === 'POST' && req.url === '/api/users');

// Verifier le body
const req = httpController.expectOne('/api/users');
expect(req.request.body).toEqual({ name: 'John' });

// Simuler une erreur
req.flush('Not found', { status: 404, statusText: 'Not Found' });

// Erreur reseau
req.error(new ProgressEvent('error'));
```
