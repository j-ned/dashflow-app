import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { HttpEnvelopeGateway } from './http-envelope.gateway';
import { CryptoStore } from '@core/services/crypto/crypto.store';
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
    httpController.expectOne({ method: 'GET', url: '/api/envelopes' }).flush([ENVELOPE]);
    httpController.verify();

    expect(await promise).toEqual([ENVELOPE]);
  });

  it('getById() should GET /api/envelopes/:id', async () => {
    const promise = firstValueFrom(gateway.getById('env-1'));
    httpController.expectOne({ method: 'GET', url: '/api/envelopes/env-1' }).flush(ENVELOPE);
    httpController.verify();

    expect(await promise).toEqual(ENVELOPE);
  });

  it('create() should POST /api/envelopes with cleartext body when crypto is off', async () => {
    const { id, ...data } = ENVELOPE;
    const promise = firstValueFrom(gateway.create(data));
    const req = httpController.expectOne({ method: 'POST', url: '/api/envelopes' });
    expect(req.request.body).toEqual(data);
    req.flush(ENVELOPE);
    httpController.verify();

    expect(await promise).toEqual(ENVELOPE);
  });

  it('delete() should DELETE /api/envelopes/:id', async () => {
    const promise = firstValueFrom(gateway.delete('env-1'));
    httpController.expectOne({ method: 'DELETE', url: '/api/envelopes/env-1' }).flush(null);
    httpController.verify();

    await promise;
  });

  it('getTransactions() should GET /api/envelopes/:id/transactions', async () => {
    const tx = { id: 'tx-1', envelopeId: 'env-1', amount: 100, date: '2026-03-01' };
    const promise = firstValueFrom(gateway.getTransactions('env-1'));
    httpController.expectOne({ method: 'GET', url: '/api/envelopes/env-1/transactions' }).flush([tx]);
    httpController.verify();

    expect(await promise).toEqual([tx]);
  });

  it.each([
    { id: 'env-1', expectedUrl: '/api/envelopes/env-1' },
    { id: 'env-42', expectedUrl: '/api/envelopes/env-42' },
    { id: 'abc-def', expectedUrl: '/api/envelopes/abc-def' },
  ])('getById() builds correct URL for id=$id', async ({ id, expectedUrl }) => {
    const promise = firstValueFrom(gateway.getById(id));
    httpController.expectOne({ method: 'GET', url: expectedUrl }).flush({ ...ENVELOPE, id });
    httpController.verify();

    const result = await promise;
    expect(result.id).toBe(id);
  });
});
