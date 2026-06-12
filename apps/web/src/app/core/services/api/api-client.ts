import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '@env/environment';

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  get<T>(path: string): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${path}`).pipe(catchError((e) => this.handleError(e)));
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
    const httpError = error as {
      status?: number;
      error?: { error?: string; message?: string; code?: string };
    };
    const message =
      httpError?.error?.error ?? httpError?.error?.message ?? 'Une erreur est survenue';
    const code = httpError?.error?.code;
    const status = httpError?.status ?? 0;
    return throwError(() => ({ status, message, code }));
  }
}
