import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { HttpAppointmentGateway } from './http-appointment.gateway';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { Appointment } from '../domain/models/appointment.model';
import { ApiRow, decryptEntity } from '@core/services/crypto/entity-crypto';

async function waitForRequest(http: HttpTestingController, method: string, url: string) {
  for (let i = 0; i < 100; i++) {
    const [req] = http.match((r) => r.method === method && r.url === url);
    if (req) return req;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`Aucune requête ${method} ${url}`);
}

const APPOINTMENT: Appointment = {
  id: 'appt-1',
  patientId: 'pat-1',
  practitionerId: 'prac-1',
  date: '2026-10-02',
  time: '09:30',
  status: 'scheduled',
  reason: 'Contrôle annuel',
  outcome: null,
};

function setup(key: CryptoKey | null) {
  TestBed.configureTestingModule({
    providers: [
      HttpAppointmentGateway,
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: CryptoStore, useValue: { getMasterKey: () => key } },
    ],
  });
  return {
    gateway: TestBed.inject(HttpAppointmentGateway),
    http: TestBed.inject(HttpTestingController),
  };
}

describe('HttpAppointmentGateway.updateStatus', () => {
  it.each(['completed', 'cancelled'] as const)(
    'en clair : PATCH /appointments/:id/status avec { status: %s }',
    async (status) => {
      const { gateway, http } = setup(null);

      const promise = firstValueFrom(gateway.updateStatus(APPOINTMENT, status));
      const req = http.expectOne({
        method: 'PATCH',
        url: `${environment.apiUrl}/appointments/appt-1/status`,
      });
      expect(req.request.body).toEqual({ status });
      req.flush({ ...APPOINTMENT, status });
      http.verify();

      expect((await promise).status).toBe(status);
    },
  );

  it('en E2EE : le statut vit dans le blob → PUT du rendez-vous rechiffré, motif et date conservés, aucun PATCH', async () => {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]);
    const { gateway, http } = setup(key);

    const promise = firstValueFrom(gateway.updateStatus(APPOINTMENT, 'completed'));
    // Le chiffrement est asynchrone : la requête part après un tick.
    const req = await waitForRequest(http, 'PUT', `${environment.apiUrl}/appointments/appt-1`);
    const body = req.request.body as ApiRow;
    expect(body['status']).toBeUndefined();
    expect(body['patientId']).toBe('pat-1');
    const plain = await decryptEntity<Appointment>(
      { id: 'appt-1', encryptedData: body.encryptedData },
      key,
    );
    expect(plain.status).toBe('completed');
    expect(plain.reason).toBe('Contrôle annuel');
    expect(plain.date).toBe('2026-10-02');
    req.flush({
      id: 'appt-1',
      patientId: 'pat-1',
      practitionerId: 'prac-1',
      encryptedData: body.encryptedData,
    });
    http.verify();

    expect((await promise).status).toBe('completed');
  });
});
