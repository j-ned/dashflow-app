import { inject, Injectable } from '@angular/core';
import { from, Observable, switchMap } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { encryptEntity, decryptEntities, decryptEntity } from '@core/services/crypto/entity-crypto';
import { Envelope } from '../domain/models/envelope.model';
import { EnvelopeTransaction } from '../domain/models/envelope-transaction.model';
import { EnvelopeGateway } from '../domain/gateways/envelope.gateway';

const CLEARTEXT_KEYS = ['id', 'userId', 'memberId'] as const;
const TX_CLEARTEXT_KEYS = ['id', 'envelopeId', 'createdAt'] as const;

@Injectable()
export class HttpEnvelopeGateway implements EnvelopeGateway {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  getAll(): Observable<Envelope[]> {
    return this.api.get<any[]>('/envelopes').pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows as Envelope[]]);
        return from(decryptEntities<Envelope>(rows, key));
      }),
    );
  }

  getById(id: string): Observable<Envelope> {
    return this.api.get<any>(`/envelopes/${id}`).pipe(
      switchMap((row) => {
        const key = this.crypto.getMasterKey();
        if (!key || !row.encryptedData) return from([row as Envelope]);
        return from(decryptEntity<Envelope>(row, key));
      }),
    );
  }

  create(data: Omit<Envelope, 'id'>): Observable<Envelope> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.post('/envelopes', data);

    return from(encryptEntity(data as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.post<any>('/envelopes', encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<Envelope>(row, key)) : from([row as Envelope])),
    );
  }

  update(id: string, data: Partial<Omit<Envelope, 'id'>>): Observable<Envelope> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.put(`/envelopes/${id}`, data);

    return from(encryptEntity(data as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.put<any>(`/envelopes/${id}`, encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<Envelope>(row, key)) : from([row as Envelope])),
    );
  }

  updateBalance(id: string, amount: number, date: string, envelope?: Envelope): Observable<Envelope> {
    const key = this.crypto.getMasterKey();
    const payload: Record<string, unknown> = { amount, date };

    if (!key) return this.api.patch(`/envelopes/${id}/balance`, payload);

    if (envelope && envelope.target) {
      payload['target'] = Math.max(0, Number(envelope.target) - amount);
    }

    return from(encryptEntity(payload, [], key)).pipe(
      switchMap((encrypted) => this.api.patch<any>(`/envelopes/${id}/balance`, encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<Envelope>(row, key)) : from([row as Envelope])),
    );
  }

  getTransactions(envelopeId: string): Observable<EnvelopeTransaction[]> {
    return this.api.get<any[]>(`/envelopes/${envelopeId}/transactions`).pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows as EnvelopeTransaction[]]);
        return from(decryptEntities<EnvelopeTransaction>(rows, key));
      }),
    );
  }

  addTransaction(envelopeId: string, data: { amount: number; date: string }): Observable<EnvelopeTransaction> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.post(`/envelopes/${envelopeId}/transactions`, data);

    return from(encryptEntity(data as Record<string, unknown>, TX_CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.post<any>(`/envelopes/${envelopeId}/transactions`, encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<EnvelopeTransaction>(row, key)) : from([row as EnvelopeTransaction])),
    );
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/envelopes/${id}`);
  }
}
