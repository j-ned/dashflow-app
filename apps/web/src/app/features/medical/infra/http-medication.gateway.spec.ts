import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { HttpMedicationGateway } from './http-medication.gateway';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { Medication } from '../domain/models/medication.model';

describe('HttpMedicationGateway', () => {
  let gateway: HttpMedicationGateway;
  let httpController: HttpTestingController;

  const mockCryptoStore = { getMasterKey: () => null };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HttpMedicationGateway,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CryptoStore, useValue: mockCryptoStore },
      ],
    });
    gateway = TestBed.inject(HttpMedicationGateway);
    httpController = TestBed.inject(HttpTestingController);
  });

  const MEDICATION: Medication = {
    id: 'med-1',
    prescriptionId: 'rx-1',
    patientId: 'pat-1',
    name: 'Doliprane',
    type: 'comprime',
    dosage: '1000mg',
    quantity: 30,
    dailyRate: 3,
    startDate: '2026-03-01',
    alertDaysBefore: 5,
    skipDays: [],
  };

  it('getAll() should GET /api/medications and return medications', async () => {
    const promise = firstValueFrom(gateway.getAll());
    httpController.expectOne({ method: 'GET', url: '/api/medications' }).flush([MEDICATION]);
    httpController.verify();

    expect(await promise).toEqual([MEDICATION]);
  });

  it('create() should POST /api/medications with cleartext body when crypto is off', async () => {
    const { id, ...data } = MEDICATION;
    const promise = firstValueFrom(gateway.create(data));
    const req = httpController.expectOne({ method: 'POST', url: '/api/medications' });
    expect(req.request.body).toEqual(data);
    req.flush(MEDICATION);
    httpController.verify();

    expect(await promise).toEqual(MEDICATION);
  });

  it('refill() should PATCH /api/medications/:id/refill with quantity', async () => {
    const promise = firstValueFrom(gateway.refill('med-1', 20));
    const req = httpController.expectOne({ method: 'PATCH', url: '/api/medications/med-1/refill' });
    expect(req.request.body).toEqual({ quantity: 20 });
    req.flush(MEDICATION);
    httpController.verify();

    expect(await promise).toEqual(MEDICATION);
  });

  it('delete() should DELETE /api/medications/:id', async () => {
    const promise = firstValueFrom(gateway.delete('med-1'));
    httpController.expectOne({ method: 'DELETE', url: '/api/medications/med-1' }).flush(null);
    httpController.verify();

    await promise;
  });

  it('getAlerts() should GET /api/medications/alerts', async () => {
    const alert = { ...MEDICATION, daysRemaining: 3, estimatedRunOut: '2026-03-15', isLow: true };
    const promise = firstValueFrom(gateway.getAlerts());
    httpController.expectOne({ method: 'GET', url: '/api/medications/alerts' }).flush([alert]);
    httpController.verify();

    expect(await promise).toEqual([alert]);
  });

  it.each([
    { id: 'med-1', expectedUrl: '/api/medications/med-1/refill' },
    { id: 'med-99', expectedUrl: '/api/medications/med-99/refill' },
  ])('refill() builds correct URL for id=$id', async ({ id, expectedUrl }) => {
    const promise = firstValueFrom(gateway.refill(id, 10));
    httpController.expectOne({ method: 'PATCH', url: expectedUrl }).flush({ ...MEDICATION, id });
    httpController.verify();

    const result = await promise;
    expect(result.id).toBe(id);
  });
});
