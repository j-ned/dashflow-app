import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

const TOKEN_KEY = 'auth_token';

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  private get headers(): HttpHeaders {
    const token = this.getToken();
    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }

  get<T>(path: string): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${path}`, { headers: this.headers })
      .pipe(catchError((e) => this.handleError(e)));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${path}`, body, { headers: this.headers })
      .pipe(catchError((e) => this.handleError(e)));
  }

  postForm<T>(path: string, formData: FormData): Observable<T> {
    const token = this.getToken();
    const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
    return this.http.post<T>(`${this.baseUrl}${path}`, formData, { headers })
      .pipe(catchError((e) => this.handleError(e)));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${path}`, body, { headers: this.headers })
      .pipe(catchError((e) => this.handleError(e)));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body, { headers: this.headers })
      .pipe(catchError((e) => this.handleError(e)));
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${path}`, { headers: this.headers })
      .pipe(catchError((e) => this.handleError(e)));
  }

  getBlob(path: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}${path}`, { headers: this.headers, responseType: 'blob' })
      .pipe(catchError((e) => this.handleError(e)));
  }

  private handleError(error: unknown): Observable<never> {
    const httpError = error as { status?: number; error?: { error?: string } };
    const message = httpError?.error?.error ?? 'Une erreur est survenue';
    const status = httpError?.status ?? 0;

    if (status === 401) {
      this.clearToken();
    }

    return throwError(() => ({ status, message }));
  }
}
