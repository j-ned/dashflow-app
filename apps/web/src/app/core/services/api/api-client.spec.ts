import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { ApiClient } from './api-client';

const BASE = environment.apiUrl;

describe('ApiClient : normalisation des erreurs HTTP', () => {
  let api: ApiClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ApiClient],
    });
    api = TestBed.inject(ApiClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it("given le body d'erreur du filtre global backend (statusCode/error/message/code), when une requête échoue, then message porte le détail métier, pas le libellé HTTP générique", async () => {
    const promise = firstValueFrom(api.post('/auth/reset-password', {}));
    const req = httpMock.expectOne(`${BASE}/auth/reset-password`);

    // Forme réelle produite par HttpExceptionFilter (nest-dashflow-app) : `error` est le
    // libellé HTTP générique, `message` porte le détail métier (cf. audit sécurité front/back).
    req.flush(
      {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Le mot de passe doit faire au moins 12 caractères',
        path: '/auth/reset-password',
        timestamp: new Date().toISOString(),
      },
      { status: 400, statusText: 'Bad Request' },
    );

    const result = await promise.catch((e: unknown) => e);
    expect(result).toMatchObject({
      status: 400,
      message: 'Le mot de passe doit faire au moins 12 caractères',
    });
  });

  it('given un code métier dans le body, when une requête échoue, then code est extrait', async () => {
    const promise = firstValueFrom(api.post('/auth/login', {}));
    const req = httpMock.expectOne(`${BASE}/auth/login`);

    req.flush(
      {
        statusCode: 403,
        error: 'Forbidden',
        message: 'Email non vérifié',
        code: 'EMAIL_NOT_VERIFIED',
        path: '/auth/login',
        timestamp: new Date().toISOString(),
      },
      { status: 403, statusText: 'Forbidden' },
    );

    const result = await promise.catch((e: unknown) => e);
    expect(result).toMatchObject({ status: 403, code: 'EMAIL_NOT_VERIFIED' });
  });

  it("given un body d'erreur sans champ message exploitable, when une requête échoue, then retombe sur le libellé HTTP générique", async () => {
    const promise = firstValueFrom(api.get('/auth/me'));
    const req = httpMock.expectOne(`${BASE}/auth/me`);

    req.flush(
      { statusCode: 401, error: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' },
    );

    const result = await promise.catch((e: unknown) => e);
    expect(result).toMatchObject({ status: 401, message: 'Unauthorized' });
  });
});
