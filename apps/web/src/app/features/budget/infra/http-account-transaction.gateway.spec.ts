import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env/environment';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { encryptEntity } from '@core/services/crypto/entity-crypto';
import { HttpAccountTransactionGateway } from './http-account-transaction.gateway';

const BASE = environment.apiUrl;

describe('HttpAccountTransactionGateway (plaintext)', () => {
  let gateway: HttpAccountTransactionGateway;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        HttpAccountTransactionGateway,
        { provide: CryptoStore, useValue: { getMasterKey: () => null } },
      ],
    });
    gateway = TestBed.inject(HttpAccountTransactionGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('coerce amount en number (plaintext)', () => {
    let received: number | undefined;
    gateway.getForAccount('acc-1').subscribe((txs) => { received = txs[0]?.amount; });
    const req = httpMock.expectOne(`${BASE}/bank-accounts/acc-1/transactions`);
    req.flush([{ id: 't1', accountId: 'acc-1', amount: '12.50', direction: 'expense', toAccountId: null, date: '2026-06-01', category: 'food', note: null, memberId: null, recurringEntryId: null }]);
    httpMock.verify();
    expect(received).toBe(12.5);
  });
});

describe('HttpAccountTransactionGateway (E2EE)', () => {
  let gateway: HttpAccountTransactionGateway;
  let httpMock: HttpTestingController;
  let key: CryptoKey;

  const CLEARTEXT_KEYS = ['id', 'userId', 'accountId', 'toAccountId', 'direction', 'memberId', 'recurringEntryId', 'createdAt'] as const;

  beforeAll(async () => {
    key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        HttpAccountTransactionGateway,
        { provide: CryptoStore, useValue: { getMasterKey: () => key } },
      ],
    });
    gateway = TestBed.inject(HttpAccountTransactionGateway);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('chiffre puis déchiffre à la création (E2EE)', async () => {
    const promise = firstValueFrom(
      gateway.create('acc-1', { amount: 30, direction: 'expense', toAccountId: null, date: '2026-06-02', category: 'food', note: 'courses', memberId: null, recurringEntryId: null }),
    );

    await new Promise((r) => setTimeout(r, 0)); // le POST part après le chiffrement async

    const req = httpMock.expectOne(`${BASE}/bank-accounts/acc-1/transactions`);
    expect(req.request.body.encryptedData).toBeTruthy();
    expect(req.request.body.amount).toBeUndefined();

    const row = await encryptEntity(
      { id: 't9', accountId: 'acc-1', amount: 30, direction: 'expense', toAccountId: null, date: '2026-06-02', category: 'food', note: 'courses', memberId: null, recurringEntryId: null } as Record<string, unknown>,
      CLEARTEXT_KEYS,
      key,
    );
    req.flush(row);
    httpMock.verify();

    const result = await promise;
    expect(result.amount).toBe(30);
  });
});
