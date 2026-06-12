import { inject, Injectable } from '@angular/core';
import { from, map, Observable, switchMap } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { ApiRow, decryptEntities, decryptEntity } from '@core/services/crypto/entity-crypto';
import { decryptList, mutateEncrypted } from '@core/services/crypto/crypto-transport';
import { validateList, validateOne } from '@core/services/crypto/validate-decrypted';
import { Medication, MedicationWithStock } from '../domain/models/medication.model';
import { MedicationGateway } from '../domain/gateways/medication.gateway';
import { MedicationSchema } from './schemas/medication.schema';

const CLEARTEXT_KEYS = ['id', 'userId', 'prescriptionId', 'patientId', 'createdAt'] as const;

@Injectable()
export class HttpMedicationGateway implements MedicationGateway {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  getAll(): Observable<Medication[]> {
    return this.api.get<ApiRow[]>('/medications').pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows as Medication[]]);
        return from(decryptEntities<Medication>(rows, key)).pipe(
          map((list) => validateList(MedicationSchema, list, { entity: 'Medication' })),
        );
      }),
    );
  }

  getById(id: string): Observable<Medication> {
    return this.api.get<ApiRow>(`/medications/${id}`).pipe(
      switchMap((row) => {
        const key = this.crypto.getMasterKey();
        if (!key || !row.encryptedData) return from([row as Medication]);
        return from(decryptEntity<Medication>(row, key)).pipe(
          map((m) => validateOne(MedicationSchema, m, { entity: 'Medication' })),
        );
      }),
    );
  }

  getAlerts(): Observable<MedicationWithStock[]> {
    return decryptList<MedicationWithStock>(
      this.api.get<ApiRow[]>('/medications/alerts'),
      this.crypto.getMasterKey(),
    );
  }

  create(data: Omit<Medication, 'id'>): Observable<Medication> {
    return mutateEncrypted(
      data as Record<string, unknown>,
      CLEARTEXT_KEYS,
      this.crypto.getMasterKey(),
      (body) => this.api.post<ApiRow>('/medications', body),
    );
  }

  update(id: string, data: Partial<Omit<Medication, 'id'>>): Observable<Medication> {
    return mutateEncrypted(
      data as Record<string, unknown>,
      CLEARTEXT_KEYS,
      this.crypto.getMasterKey(),
      (body) => this.api.put<ApiRow>(`/medications/${id}`, body),
    );
  }

  refill(id: string, quantity: number): Observable<Medication> {
    return mutateEncrypted(
      { quantity },
      CLEARTEXT_KEYS,
      this.crypto.getMasterKey(),
      (body) => this.api.patch<ApiRow>(`/medications/${id}/refill`, body),
    );
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/medications/${id}`);
  }
}
