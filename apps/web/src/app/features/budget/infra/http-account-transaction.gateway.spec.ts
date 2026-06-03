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

async function waitForRequest(httpMock: HttpTestingController, url: string, tries = 50) {
  for (let i = 0; i < tries; i++) {
    const reqs = httpMock.match(url);
    if (reqs.length === 1) return reqs[0];
    if (reqs.length > 1) throw new Error(`multiple requests for ${url}`);
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error(`no request emitted for ${url}`);
}

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

  it('createBatch poste un tableau (plaintext)', () => {
    let n = 0;
    gateway.createBatch('acc-1', [
      { amount: 10, direction: 'expense', toAccountId: null, date: '2026-06-01', category: 'food', note: null, memberId: null, recurringEntryId: null },
      { amount: 20, direction: 'income', toAccountId: null, date: '2026-06-02', category: null, note: null, memberId: null, recurringEntryId: null },
    ]).subscribe((rows) => (n = rows.length));
    const req = httpMock.expectOne(`${BASE}/bank-accounts/acc-1/transactions/batch`);
    expect(req.request.body.items.length).toBe(2);
    req.flush([{ id: 'a' }, { id: 'b' }]);
    expect(n).toBe(2);
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

    const req = await waitForRequest(httpMock, `${BASE}/bank-accounts/acc-1/transactions`);
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

  it('chiffre chaque item du batch (E2EE)', async () => {
    const promise = firstValueFrom(
      gateway.createBatch('acc-1', [
        { amount: 10, direction: 'expense', toAccountId: null, date: '2026-06-01', category: 'food', note: null, memberId: null, recurringEntryId: null },
        { amount: 20, direction: 'income', toAccountId: null, date: '2026-06-02', category: null, note: null, memberId: null, recurringEntryId: null },
      ]),
    );

    const req = await waitForRequest(httpMock, `${BASE}/bank-accounts/acc-1/transactions/batch`);
    expect(req.request.body.items.length).toBe(2);
    expect(req.request.body.items[0].encryptedData).toBeTruthy();
    expect(req.request.body.items[0].amount).toBeUndefined();
    expect(req.request.body.items[1].encryptedData).toBeTruthy();
    expect(req.request.body.items[1].amount).toBeUndefined();

    req.flush([{ id: 'a' }, { id: 'b' }]);
    httpMock.verify();

    const rows = await promise;
    expect(rows.length).toBe(2);
  });
});
