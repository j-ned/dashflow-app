import { inject, Injectable } from '@angular/core';
import { from, map, Observable, switchMap } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { ApiRow, decryptEntities, decryptEntity } from '@core/services/crypto/entity-crypto';
import { mutateEncrypted } from '@core/services/crypto/crypto-transport';
import { validateList, validateOne } from '@core/services/crypto/validate-decrypted';
import { Practitioner } from '../domain/models/practitioner.model';
import { PractitionerGateway } from '../domain/gateways/practitioner.gateway';
import { PractitionerSchema } from './schemas/practitioner.schema';

const CLEARTEXT_KEYS = ['id', 'userId', 'createdAt'] as const;

@Injectable()
export class HttpPractitionerGateway implements PractitionerGateway {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  getAll(): Observable<Practitioner[]> {
    return this.api.get<ApiRow[]>('/practitioners').pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows as Practitioner[]]);
        return from(decryptEntities<Practitioner>(rows, key)).pipe(
          map((list) => validateList(PractitionerSchema, list, { entity: 'Practitioner' })),
        );
      }),
    );
  }

  getById(id: string): Observable<Practitioner> {
    return this.api.get<ApiRow>(`/practitioners/${id}`).pipe(
      switchMap((row) => {
        const key = this.crypto.getMasterKey();
        if (!key || !row.encryptedData) return from([row as Practitioner]);
        return from(decryptEntity<Practitioner>(row, key)).pipe(
          map((p) => validateOne(PractitionerSchema, p, { entity: 'Practitioner' })),
        );
      }),
    );
  }

  create(data: Omit<Practitioner, 'id'>): Observable<Practitioner> {
    return mutateEncrypted(
      data as Record<string, unknown>,
      CLEARTEXT_KEYS,
      this.crypto.getMasterKey(),
      (body) => this.api.post<ApiRow>('/practitioners', body),
    );
  }

  update(id: string, data: Partial<Omit<Practitioner, 'id'>>): Observable<Practitioner> {
    return mutateEncrypted(
      data as Record<string, unknown>,
      CLEARTEXT_KEYS,
      this.crypto.getMasterKey(),
      (body) => this.api.put<ApiRow>(`/practitioners/${id}`, body),
    );
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/practitioners/${id}`);
  }
}
