import { inject, Injectable } from '@angular/core';
import { from, map, Observable, switchMap } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { ApiRow, decryptEntities, decryptEntity } from '@core/services/crypto/entity-crypto';
import { mutateEncrypted } from '@core/services/crypto/crypto-transport';
import { validateList, validateOne } from '@core/services/crypto/validate-decrypted';
import { Patient } from '../domain/models/patient.model';
import { PatientGateway } from '../domain/gateways/patient.gateway';
import { PatientSchema } from './schemas/patient.schema';

const CLEARTEXT_KEYS = ['id', 'userId', 'createdAt'] as const;

@Injectable()
export class HttpPatientGateway implements PatientGateway {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  getAll(): Observable<Patient[]> {
    return this.api.get<ApiRow[]>('/patients').pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows as Patient[]]);
        return from(decryptEntities<Patient>(rows, key)).pipe(
          map((list) => validateList(PatientSchema, list, { entity: 'Patient' })),
        );
      }),
    );
  }

  getById(id: string): Observable<Patient> {
    return this.api.get<ApiRow>(`/patients/${id}`).pipe(
      switchMap((row) => {
        const key = this.crypto.getMasterKey();
        if (!key || !row.encryptedData) return from([row as Patient]);
        return from(decryptEntity<Patient>(row, key)).pipe(
          map((p) => validateOne(PatientSchema, p, { entity: 'Patient' })),
        );
      }),
    );
  }

  create(data: Omit<Patient, 'id'>): Observable<Patient> {
    return mutateEncrypted(
      data as Record<string, unknown>,
      CLEARTEXT_KEYS,
      this.crypto.getMasterKey(),
      (body) => this.api.post<ApiRow>('/patients', body),
    );
  }

  update(id: string, data: Partial<Omit<Patient, 'id'>>): Observable<Patient> {
    return mutateEncrypted(
      data as Record<string, unknown>,
      CLEARTEXT_KEYS,
      this.crypto.getMasterKey(),
      (body) => this.api.put<ApiRow>(`/patients/${id}`, body),
    );
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/patients/${id}`);
  }
}
