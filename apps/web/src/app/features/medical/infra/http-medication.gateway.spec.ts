import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { HttpMedicationGateway } from './http-medication.gateway';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { Medication } from '../domain/models/medication.model';
import { ApiRow, decryptEntity } from '@core/services/crypto/entity-crypto';

async function waitForRequest(http: HttpTestingController, method: string, url: string) {
  for (let i = 0; i < 100; i++) {
    const [req] = http.match((r) => r.method === method && r.url === url);
    if (req) return req;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`Aucune requête ${method} ${url}`);
}

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
    httpController
      .expectOne({ method: 'GET', url: `${environment.apiUrl}/medications` })
      .flush([MEDICATION]);
    httpController.verify();

    expect(await promise).toEqual([MEDICATION]);
  });

  it('create() should POST /api/medications with cleartext body when crypto is off', async () => {
    const { id, ...data } = MEDICATION;
    const promise = firstValueFrom(gateway.create(data));
    const req = httpController.expectOne({
      method: 'POST',
      url: `${environment.apiUrl}/medications`,
    });
    expect(req.request.body).toEqual(data);
    req.flush(MEDICATION);
    httpController.verify();

    expect(await promise).toEqual(MEDICATION);
  });

  it('refill() en clair : PATCH /api/medications/:id/refill avec la quantité', async () => {
    const promise = firstValueFrom(gateway.refill(MEDICATION, 20));
    const req = httpController.expectOne({
      method: 'PATCH',
      url: `${environment.apiUrl}/medications/med-1/refill`,
    });
    expect(req.request.body).toEqual({ quantity: 20 });
    req.flush(MEDICATION);
    httpController.verify();

    expect(await promise).toEqual(MEDICATION);
  });

  it('delete() should DELETE /api/medications/:id', async () => {
    const promise = firstValueFrom(gateway.delete('med-1'));
    httpController
      .expectOne({ method: 'DELETE', url: `${environment.apiUrl}/medications/med-1` })
      .flush(null);
    httpController.verify();

    await promise;
  });

  it('getAlerts() should GET /api/medications/alerts', async () => {
    const alert = { ...MEDICATION, daysRemaining: 3, estimatedRunOut: '2026-03-15', isLow: true };
    const promise = firstValueFrom(gateway.getAlerts());
    httpController
      .expectOne({ method: 'GET', url: `${environment.apiUrl}/medications/alerts` })
      .flush([alert]);
    httpController.verify();

    expect(await promise).toEqual([alert]);
  });

  it.each([
    { id: 'med-1', expectedUrl: `${environment.apiUrl}/medications/med-1/refill` },
    { id: 'med-99', expectedUrl: `${environment.apiUrl}/medications/med-99/refill` },
  ])('refill() builds correct URL for id=$id', async ({ id, expectedUrl }) => {
    const promise = firstValueFrom(gateway.refill({ ...MEDICATION, id }, 10));
    httpController.expectOne({ method: 'PATCH', url: expectedUrl }).flush({ ...MEDICATION, id });
    httpController.verify();

    const result = await promise;
    expect(result.id).toBe(id);
  });

  it('refill() en E2EE : le serveur ne peut pas additionner dans le blob → PUT du médicament rechiffré avec le nouveau stock', async () => {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        HttpMedicationGateway,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CryptoStore, useValue: { getMasterKey: () => key } },
      ],
    });
    const e2eeGateway = TestBed.inject(HttpMedicationGateway);
    const e2eeHttp = TestBed.inject(HttpTestingController);

    const promise = firstValueFrom(e2eeGateway.refill(MEDICATION, 20));
    // Le chiffrement est asynchrone : la requête part après un tick.
    const req = await waitForRequest(e2eeHttp, 'PUT', `${environment.apiUrl}/medications/med-1`);
    const body = req.request.body as ApiRow;
    expect(body['quantity']).toBeUndefined();
    const plain = await decryptEntity<Medication>(
      { id: 'med-1', encryptedData: body.encryptedData },
      key,
    );
    expect(plain.quantity).toBe(50);
    expect(plain.name).toBe('Doliprane');
    req.flush({ id: 'med-1', patientId: 'pat-1', encryptedData: body.encryptedData });
    e2eeHttp.verify();
    expect((await promise).quantity).toBe(50);
  });
});
