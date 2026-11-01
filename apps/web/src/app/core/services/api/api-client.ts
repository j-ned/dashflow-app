import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, of, switchMap, throwError } from 'rxjs';
import { environment } from '@env/environment';

type QueryParams = Record<string, string | number | boolean>;

/** Forme normalisée des erreurs renvoyées par ApiClient (cf. handleError). */
export type ApiError = { status: number; message: string; code?: string; details?: unknown };

/** En-tête posé par le backend quand une liste a une page suivante (pagination par curseur). */
export const NEXT_CURSOR_HEADER = 'X-Next-Cursor';
/** Garde-fou : 200 pages × 500 lignes = 100 000 lignes, très au-delà d'un foyer. */
const MAX_PAGES = 200;

function isApiError(e: unknown): e is ApiError {
  return (
    !!e &&
    typeof e === 'object' &&
    !('error' in e) &&
    typeof (e as ApiError).status === 'number' &&
    typeof (e as ApiError).message === 'string'
  );
}

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  get<T>(path: string, params?: QueryParams): Observable<T> {
    const httpParams = params ? this.toHttpParams(params) : undefined;
    return this.http
      .get<T>(`${this.baseUrl}${path}`, { params: httpParams })
      .pipe(catchError((e) => this.handleError(e)));
  }

  /**
   * Liste paginée par curseur : suit `X-Next-Cursor` jusqu'à la dernière page et concatène.
   * L'appelant reçoit toujours la liste complète — plus de troncature silencieuse à 1000
   * lignes qui faussait les soldes calculés côté client.
   */
  getList<T>(path: string, params?: QueryParams): Observable<T[]> {
    const page = (after: string | undefined, acc: T[], n: number): Observable<T[]> =>
      this.http
        .get<T[]>(`${this.baseUrl}${path}`, {
          params: this.toHttpParams({ ...(params ?? {}), ...(after ? { after } : {}) }),
          observe: 'response',
        })
        .pipe(
          switchMap((res) => {
            const items = acc.concat(res.body ?? []);
            const next = res.headers.get(NEXT_CURSOR_HEADER);
            if (!next) return of(items);
            if (n + 1 >= MAX_PAGES) {
              return throwError(
                (): ApiError => ({
                  status: 0,
                  message: 'Liste trop longue : pagination interrompue',
                  code: 'PAGINATION_OVERFLOW',
                }),
              );
            }
            return page(next, items, n + 1);
          }),
        );
    return page(undefined, [], 0).pipe(catchError((e) => this.handleError(e)));
  }

  private toHttpParams(params: QueryParams): HttpParams {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      httpParams = httpParams.set(key, value);
    }
    return httpParams;
  }
  post<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .post<T>(`${this.baseUrl}${path}`, body)
      .pipe(catchError((e) => this.handleError(e)));
  }
  postForm<T>(path: string, formData: FormData): Observable<T> {
    return this.http
      .post<T>(`${this.baseUrl}${path}`, formData)
      .pipe(catchError((e) => this.handleError(e)));
  }
  put<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .put<T>(`${this.baseUrl}${path}`, body)
      .pipe(catchError((e) => this.handleError(e)));
  }
  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .patch<T>(`${this.baseUrl}${path}`, body)
      .pipe(catchError((e) => this.handleError(e)));
  }
  delete<T>(path: string): Observable<T> {
    return this.http
      .delete<T>(`${this.baseUrl}${path}`)
      .pipe(catchError((e) => this.handleError(e)));
  }
  getBlob(path: string): Observable<Blob> {
    return this.http
      .get(`${this.baseUrl}${path}`, { responseType: 'blob' })
      .pipe(catchError((e) => this.handleError(e)));
  }

  private handleError(error: unknown): Observable<never> {
    if (isApiError(error)) return throwError(() => error); // déjà normalisée (getList)
    const httpError = error as {
      status?: number;
      error?: { message?: string; error?: string; code?: string; details?: unknown };
    };
    // `message` porte le détail métier (ex. "Le mot de passe doit faire au moins 12
    // caractères") ; `error` n'est que le libellé HTTP générique (ex. "Bad Request") posé par
    // le filtre d'exception global du backend, à ne lire qu'en dernier recours.
    const message =
      httpError?.error?.message ?? httpError?.error?.error ?? 'Une erreur est survenue';
    const code = httpError?.error?.code;
    const details = httpError?.error?.details;
    const status = httpError?.status ?? 0;
    return throwError((): ApiError => ({ status, message, code, details }));
  }
}
