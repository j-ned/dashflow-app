import { inject, Injectable } from '@angular/core';
import { from, Observable, switchMap } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { encryptEntity, decryptEntities, decryptEntity } from '@core/services/crypto/entity-crypto';
import { Practitioner } from '../domain/models/practitioner.model';
import { PractitionerGateway } from '../domain/gateways/practitioner.gateway';

const CLEARTEXT_KEYS = ['id', 'userId', 'createdAt'] as const;

@Injectable()
export class HttpPractitionerGateway extends PractitionerGateway {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  getAll(): Observable<Practitioner[]> {
    return this.api.get<any[]>('/practitioners').pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows as Practitioner[]]);
        return from(decryptEntities<Practitioner>(rows, key));
      }),
    );
  }

  getById(id: string): Observable<Practitioner> {
    return this.api.get<any>(`/practitioners/${id}`).pipe(
      switchMap((row) => {
        const key = this.crypto.getMasterKey();
        if (!key || !row.encryptedData) return from([row as Practitioner]);
        return from(decryptEntity<Practitioner>(row, key));
      }),
    );
  }

  create(data: Omit<Practitioner, 'id'>): Observable<Practitioner> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.post('/practitioners', data);

    return from(encryptEntity(data as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.post<any>('/practitioners', encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<Practitioner>(row, key)) : from([row as Practitioner])),
    );
  }

  update(id: string, data: Partial<Omit<Practitioner, 'id'>>): Observable<Practitioner> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.put(`/practitioners/${id}`, data);

    return from(encryptEntity(data as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.put<any>(`/practitioners/${id}`, encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<Practitioner>(row, key)) : from([row as Practitioner])),
    );
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/practitioners/${id}`);
  }
}
