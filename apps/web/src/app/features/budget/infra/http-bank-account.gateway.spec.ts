import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, expect, it, beforeEach, beforeAll, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { encryptEntity } from '@core/services/crypto/entity-crypto';
import { HttpBankAccountGateway } from './http-bank-account.gateway';
import { BankAccount } from '../domain/models/bank-account.model';

const BASE = environment.apiUrl;

async function waitForRequest(httpMock: HttpTestingController, url: string, tries = 50) {
  for (let i = 0; i < tries; i++) {
    const reqs = httpMock.match(url);
    if (reqs.length === 1) return reqs[0];
    if (reqs.length > 1) throw new Error(`multiple requests for ${url}`);
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error(`no request emitted for ${url}`);
}

describe('HttpBankAccountGateway — validation (F002)', () => {
  let gateway: HttpBankAccountGateway;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        HttpBankAccountGateway,
        { provide: CryptoStore, useValue: { getMasterKey: () => null } },
      ],
    });
    gateway = TestBed.inject(HttpBankAccountGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('exclut une ligne invalide de la liste sans faire échouer le GET', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let received: { id: string }[] | undefined;
    gateway.getAll().subscribe((accs) => (received = accs));

    const req = httpMock.expectOne(`${BASE}/bank-accounts`);
    req.flush([
      {
        id: 'a',
        name: 'Courant',
        type: 'courant',
        initialBalance: '100',
        color: null,
        dotColor: null,
      },
      { id: 'b', name: 42, type: 'courant', initialBalance: '0', color: null, dotColor: null },
    ]);
    httpMock.verify();

    expect(received?.map((a) => a.id)).toEqual(['a']);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe('HttpBankAccountGateway (E2EE) — régression fuite initialBalance en clair', () => {
  let gateway: HttpBankAccountGateway;
  let httpMock: HttpTestingController;
  let key: CryptoKey;

  const CLEARTEXT_KEYS = ['id', 'userId', 'createdAt'] as const;
  const ACCOUNT: BankAccount = {
    id: 'a1',
    name: 'Livret A',
    type: 'épargne',
    initialBalance: 4200,
    color: '#3B82F6',
    dotColor: null,
  };

  beforeAll(async () => {
    key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]);
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        HttpBankAccountGateway,
        { provide: CryptoStore, useValue: { getMasterKey: () => key } },
      ],
    });
    gateway = TestBed.inject(HttpBankAccountGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it("create() n'envoie jamais initialBalance en clair (montant financier réel)", async () => {
    const { id, ...data } = ACCOUNT;
    const promise = firstValueFrom(gateway.create(data));
    const req = await waitForRequest(httpMock, `${BASE}/bank-accounts`);
    expect(req.request.body.encryptedData).toBeDefined();
    expect(req.request.body.initialBalance).toBeUndefined();
    expect(req.request.body.name).toBeUndefined();

    const row = await encryptEntity(ACCOUNT as Record<string, unknown>, CLEARTEXT_KEYS, key);
    req.flush(row);
    httpMock.verify();

    expect(await promise).toEqual(ACCOUNT);
  });

  it('getAll() déchiffre initialBalance en number malgré un compte legacy dont il est encore en clair', async () => {
    // Compte legacy créé avant ce fix : name/type déjà chiffrés (encryptedData existant), mais
    // initialBalance encore présent en clair côté Postgres (string), pas encore réécrit dans le blob.
    const LEGACY_ACCOUNT = { ...ACCOUNT, id: 'a2', initialBalance: 999.5 };
    const encryptedRow = await encryptEntity(
      LEGACY_ACCOUNT as Record<string, unknown>,
      [...CLEARTEXT_KEYS, 'initialBalance'],
      key,
    );
    (encryptedRow as Record<string, unknown>)['initialBalance'] = '999.50';

    const promise = firstValueFrom(gateway.getAll());
    httpMock.expectOne(`${environment.apiUrl}/bank-accounts`).flush([encryptedRow]);
    httpMock.verify();

    const result = await promise;
    expect(result[0].initialBalance).toBe(999.5);
    expect(typeof result[0].initialBalance).toBe('number');
  });
});
