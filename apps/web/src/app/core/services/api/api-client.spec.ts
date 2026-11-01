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

describe('ApiClient.getList : pagination par curseur', () => {
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

  it('given une réponse avec X-Next-Cursor, when getList, then suit le curseur (?after=) et concatène toutes les pages', async () => {
    const promise = firstValueFrom(api.getList<{ id: string }>('/transactions/all'));

    const first = httpMock.expectOne(
      (r) => r.url === `${BASE}/transactions/all` && !r.params.has('after'),
    );
    first.flush([{ id: 'a' }, { id: 'b' }], { headers: { 'X-Next-Cursor': 'c1' } });

    const second = httpMock.expectOne(
      (r) => r.url === `${BASE}/transactions/all` && r.params.get('after') === 'c1',
    );
    second.flush([{ id: 'c' }], { headers: { 'X-Next-Cursor': 'c2' } });

    const third = httpMock.expectOne(
      (r) => r.url === `${BASE}/transactions/all` && r.params.get('after') === 'c2',
    );
    third.flush([{ id: 'd' }]); // dernière page : pas d'en-tête

    expect(await promise).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]);
  });

  it('given un backend sans en-tête (ancienne version), when getList, then une seule requête et le tableau tel quel', async () => {
    const promise = firstValueFrom(api.getList<{ id: string }>('/members'));
    httpMock.expectOne(`${BASE}/members`).flush([{ id: 'm1' }]);
    expect(await promise).toEqual([{ id: 'm1' }]);
  });

  it('given une erreur HTTP en 2e page, when getList, then erreur normalisée (message métier, pas de double normalisation)', async () => {
    const promise = firstValueFrom(api.getList('/loans'));
    httpMock
      .expectOne((r) => r.url === `${BASE}/loans`)
      .flush([], {
        headers: { 'X-Next-Cursor': 'x' },
      });
    httpMock
      .expectOne((r) => r.url === `${BASE}/loans` && r.params.get('after') === 'x')
      .flush(
        { statusCode: 400, error: 'Bad Request', message: 'Curseur de pagination invalide' },
        { status: 400, statusText: 'Bad Request' },
      );
    const result = await promise.catch((e: unknown) => e);
    expect(result).toMatchObject({ status: 400, message: 'Curseur de pagination invalide' });
  });

  it('given un body 409 avec details, when une requête échoue, then details est transmis (compteurs du dossier médical)', async () => {
    const promise = firstValueFrom(api.delete('/members/1'));
    httpMock.expectOne(`${BASE}/members/1`).flush(
      {
        statusCode: 409,
        error: 'Conflict',
        message: 'Ce membre a un dossier médical',
        code: 'MEMBER_HAS_MEDICAL_DATA',
        details: { appointments: 2, prescriptions: 0, medications: 1, documents: 0 },
      },
      { status: 409, statusText: 'Conflict' },
    );
    const result = await promise.catch((e: unknown) => e);
    expect(result).toMatchObject({
      status: 409,
      code: 'MEMBER_HAS_MEDICAL_DATA',
      details: { appointments: 2, medications: 1 },
    });
  });
});
