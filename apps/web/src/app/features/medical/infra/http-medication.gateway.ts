import { inject, Injectable } from '@angular/core';
import { from, Observable, switchMap } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { encryptEntity, decryptEntities, decryptEntity } from '@core/services/crypto/entity-crypto';
import { Medication, MedicationWithStock } from '../domain/models/medication.model';
import { MedicationGateway } from '../domain/gateways/medication.gateway';

const CLEARTEXT_KEYS = ['id', 'userId', 'prescriptionId', 'patientId', 'createdAt'] as const;

@Injectable()
export class HttpMedicationGateway implements MedicationGateway {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  getAll(): Observable<Medication[]> {
    return this.api.get<any[]>('/medications').pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows as Medication[]]);
        return from(decryptEntities<Medication>(rows, key));
      }),
    );
  }

  getById(id: string): Observable<Medication> {
    return this.api.get<any>(`/medications/${id}`).pipe(
      switchMap((row) => {
        const key = this.crypto.getMasterKey();
        if (!key || !row.encryptedData) return from([row as Medication]);
        return from(decryptEntity<Medication>(row, key));
      }),
    );
  }

  getAlerts(): Observable<MedicationWithStock[]> {
    return this.api.get<any[]>('/medications/alerts').pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows as MedicationWithStock[]]);
        return from(decryptEntities<MedicationWithStock>(rows, key));
      }),
    );
  }

  create(data: Omit<Medication, 'id'>): Observable<Medication> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.post('/medications', data);

    return from(encryptEntity(data as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.post<any>('/medications', encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<Medication>(row, key)) : from([row as Medication])),
    );
  }

  update(id: string, data: Partial<Omit<Medication, 'id'>>): Observable<Medication> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.put(`/medications/${id}`, data);

    return from(encryptEntity(data as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.put<any>(`/medications/${id}`, encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<Medication>(row, key)) : from([row as Medication])),
    );
  }

  refill(id: string, quantity: number): Observable<Medication> {
    const key = this.crypto.getMasterKey();
    const payload = { quantity };
    if (!key) return this.api.patch(`/medications/${id}/refill`, payload);

    return from(encryptEntity(payload as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.patch<any>(`/medications/${id}/refill`, encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<Medication>(row, key)) : from([row as Medication])),
    );
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/medications/${id}`);
  }
}
