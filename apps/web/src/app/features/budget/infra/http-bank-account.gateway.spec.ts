import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { environment } from '@env/environment';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { HttpBankAccountGateway } from './http-bank-account.gateway';

const BASE = environment.apiUrl;

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
