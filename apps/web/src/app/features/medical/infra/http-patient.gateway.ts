import { inject, Injectable } from '@angular/core';
import { from, Observable, switchMap } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { encryptEntity, decryptEntities, decryptEntity } from '@core/services/crypto/entity-crypto';
import { Patient } from '../domain/models/patient.model';
import { PatientGateway } from '../domain/gateways/patient.gateway';

const CLEARTEXT_KEYS = ['id', 'userId', 'createdAt'] as const;

@Injectable()
export class HttpPatientGateway extends PatientGateway {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  getAll(): Observable<Patient[]> {
    return this.api.get<any[]>('/patients').pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows as Patient[]]);
        return from(decryptEntities<Patient>(rows, key));
      }),
    );
  }

  getById(id: string): Observable<Patient> {
    return this.api.get<any>(`/patients/${id}`).pipe(
      switchMap((row) => {
        const key = this.crypto.getMasterKey();
        if (!key || !row.encryptedData) return from([row as Patient]);
        return from(decryptEntity<Patient>(row, key));
      }),
    );
  }

  create(data: Omit<Patient, 'id'>): Observable<Patient> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.post('/patients', data);

    return from(encryptEntity(data as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.post<any>('/patients', encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<Patient>(row, key)) : from([row as Patient])),
    );
  }

  update(id: string, data: Partial<Omit<Patient, 'id'>>): Observable<Patient> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.put(`/patients/${id}`, data);

    return from(encryptEntity(data as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.put<any>(`/patients/${id}`, encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<Patient>(row, key)) : from([row as Patient])),
    );
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/patients/${id}`);
  }
}
