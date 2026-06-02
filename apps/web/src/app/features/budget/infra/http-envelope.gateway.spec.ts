import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { HttpEnvelopeGateway } from './http-envelope.gateway';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { encryptEntity } from '@core/services/crypto/entity-crypto';
import { Envelope } from '../domain/models/envelope.model';

describe('HttpEnvelopeGateway', () => {
  let gateway: HttpEnvelopeGateway;
  let httpController: HttpTestingController;

  const mockCryptoStore = { getMasterKey: () => null };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HttpEnvelopeGateway,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CryptoStore, useValue: mockCryptoStore },
      ],
    });
    gateway = TestBed.inject(HttpEnvelopeGateway);
    httpController = TestBed.inject(HttpTestingController);
  });

  const ENVELOPE: Envelope = {
    id: 'env-1',
    memberId: 'm-1',
    name: 'Épargne',
    type: 'épargne',
    balance: 500,
    target: 1000,
    color: '#3B82F6',
    dueDay: 15,
  };

  it('getAll() should GET /api/envelopes and return envelopes', async () => {
    const promise = firstValueFrom(gateway.getAll());
    httpController.expectOne({ method: 'GET', url: `${environment.apiUrl}/envelopes` }).flush([ENVELOPE]);
    httpController.verify();

    expect(await promise).toEqual([ENVELOPE]);
  });

  it('getById() should GET /api/envelopes/:id', async () => {
    const promise = firstValueFrom(gateway.getById('env-1'));
    httpController.expectOne({ method: 'GET', url: `${environment.apiUrl}/envelopes/env-1` }).flush(ENVELOPE);
    httpController.verify();

    expect(await promise).toEqual(ENVELOPE);
  });

  it('create() should POST /api/envelopes with cleartext body when crypto is off', async () => {
    const { id, ...data } = ENVELOPE;
    const promise = firstValueFrom(gateway.create(data));
    const req = httpController.expectOne({ method: 'POST', url: `${environment.apiUrl}/envelopes` });
    expect(req.request.body).toEqual(data);
    req.flush(ENVELOPE);
    httpController.verify();

    expect(await promise).toEqual(ENVELOPE);
  });

  it('delete() should DELETE /api/envelopes/:id', async () => {
    const promise = firstValueFrom(gateway.delete('env-1'));
    httpController.expectOne({ method: 'DELETE', url: `${environment.apiUrl}/envelopes/env-1` }).flush(null);
    httpController.verify();

    await promise;
  });

  it('getTransactions() should GET /api/envelopes/:id/transactions', async () => {
    const tx = { id: 'tx-1', envelopeId: 'env-1', amount: 100, date: '2026-03-01' };
    const promise = firstValueFrom(gateway.getTransactions('env-1'));
    httpController.expectOne({ method: 'GET', url: `${environment.apiUrl}/envelopes/env-1/transactions` }).flush([tx]);
    httpController.verify();

    expect(await promise).toEqual([tx]);
  });

  it.each([
    { id: 'env-1', expectedUrl: `${environment.apiUrl}/envelopes/env-1` },
    { id: 'env-42', expectedUrl: `${environment.apiUrl}/envelopes/env-42` },
    { id: 'abc-def', expectedUrl: `${environment.apiUrl}/envelopes/abc-def` },
  ])('getById() builds correct URL for id=$id', async ({ id, expectedUrl }) => {
    const promise = firstValueFrom(gateway.getById(id));
    httpController.expectOne({ method: 'GET', url: expectedUrl }).flush({ ...ENVELOPE, id });
    httpController.verify();

    const result = await promise;
    expect(result.id).toBe(id);
  });
});

describe('HttpEnvelopeGateway (E2EE)', () => {
  let gateway: HttpEnvelopeGateway;
  let httpController: HttpTestingController;
  let key: CryptoKey;

  const CLEARTEXT_KEYS = ['id', 'userId', 'memberId'] as const;
  const TX_CLEARTEXT_KEYS = ['id', 'envelopeId', 'createdAt'] as const;

  const ENVELOPE: Envelope = {
    id: 'env-1', memberId: 'm-1', name: 'Épargne', type: 'épargne',
    balance: 500, target: 1000, color: '#3B82F6', dueDay: 15,
  };
  const TX = { id: 'tx-1', envelopeId: 'env-1', amount: 100, date: '2026-03-01', note: 'salaire' };

  beforeAll(async () => {
    key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HttpEnvelopeGateway,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CryptoStore, useValue: { getMasterKey: () => key } },
      ],
    });
    gateway = TestBed.inject(HttpEnvelopeGateway);
    httpController = TestBed.inject(HttpTestingController);
  });

  it('getAll() decrypts encrypted rows back to the original entity', async () => {
    const row = await encryptEntity(ENVELOPE as Record<string, unknown>, CLEARTEXT_KEYS, key);
    expect(row['name']).toBeUndefined();
    const promise = firstValueFrom(gateway.getAll());
    httpController.expectOne({ method: 'GET', url: `${environment.apiUrl}/envelopes` }).flush([row]);
    httpController.verify();

    expect(await promise).toEqual([ENVELOPE]);
  });

  it('getById() decrypts an encrypted row', async () => {
    const row = await encryptEntity(ENVELOPE as Record<string, unknown>, CLEARTEXT_KEYS, key);
    const promise = firstValueFrom(gateway.getById('env-1'));
    httpController.expectOne({ method: 'GET', url: `${environment.apiUrl}/envelopes/env-1` }).flush(row);
    httpController.verify();

    expect(await promise).toEqual(ENVELOPE);
  });

  it('create() encrypts the body (no plaintext sensitive fields) and decrypts the response', async () => {
    const { id, ...data } = ENVELOPE;
    const promise = firstValueFrom(gateway.create(data));
    await new Promise((r) => setTimeout(r)); // wait for async encryption before the POST is issued
    const req = httpController.expectOne({ method: 'POST', url: `${environment.apiUrl}/envelopes` });
    expect(req.request.body.encryptedData).toBeDefined();
    expect(req.request.body.name).toBeUndefined();
    expect(req.request.body.balance).toBeUndefined();
    expect(req.request.body.memberId).toBe('m-1');

    const row = await encryptEntity(ENVELOPE as Record<string, unknown>, CLEARTEXT_KEYS, key);
    req.flush(row);
    httpController.verify();

    expect(await promise).toEqual(ENVELOPE);
  });

  it('getAllTransactions() decrypts encrypted transaction rows', async () => {
    const row = await encryptEntity(TX as Record<string, unknown>, TX_CLEARTEXT_KEYS, key);
    const promise = firstValueFrom(gateway.getAllTransactions());
    httpController.expectOne({ method: 'GET', url: `${environment.apiUrl}/envelopes/transactions/all` }).flush([row]);
    httpController.verify();

    expect(await promise).toEqual([TX]);
  });
});
