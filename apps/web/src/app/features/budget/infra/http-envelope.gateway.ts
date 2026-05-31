import { inject, Injectable } from '@angular/core';
import { from, Observable, switchMap } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { ApiRow, encryptEntity, decryptEntities, decryptEntity } from '@core/services/crypto/entity-crypto';
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
    return this.api.get<ApiRow[]>('/envelopes').pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows as Envelope[]]);
        return from(decryptEntities<Envelope>(rows, key));
      }),
    );
  }

  getById(id: string): Observable<Envelope> {
    return this.api.get<ApiRow>(`/envelopes/${id}`).pipe(
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
      switchMap((encrypted) => this.api.post<ApiRow>('/envelopes', encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<Envelope>(row, key)) : from([row as Envelope])),
    );
  }

  update(id: string, data: Partial<Omit<Envelope, 'id'>>): Observable<Envelope> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.put(`/envelopes/${id}`, data);

    return from(encryptEntity(data as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.put<ApiRow>(`/envelopes/${id}`, encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<Envelope>(row, key)) : from([row as Envelope])),
    );
  }

  updateBalance(id: string, amount: number, date: string, note: string | null, envelope: Envelope): Observable<Envelope> {
    const key = this.crypto.getMasterKey();

    // Plaintext: the /balance endpoint updates the balance and records the transaction.
    if (!key) return this.api.patch(`/envelopes/${id}/balance`, { amount, date, note });

    // E2EE: recompute balance client-side and re-encrypt the full envelope (PUT),
    // then record the movement as its own encrypted transaction so history stays real.
    const updatedEnvelope: Record<string, unknown> = {
      memberId: envelope.memberId,
      name: envelope.name,
      type: envelope.type,
      balance: Number(envelope.balance) + amount,
      target: envelope.target,
      color: envelope.color,
      dueDay: envelope.dueDay,
    };

    return from(encryptEntity(updatedEnvelope, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.put<ApiRow>(`/envelopes/${id}`, encrypted)),
      switchMap((row) => {
        const envelope$ = row.encryptedData ? from(decryptEntity<Envelope>(row, key)) : from([row as Envelope]);
        return from(encryptEntity({ amount, date, note } as Record<string, unknown>, TX_CLEARTEXT_KEYS, key)).pipe(
          switchMap((encryptedTx) => this.api.post(`/envelopes/${id}/transactions`, encryptedTx)),
          switchMap(() => envelope$),
        );
      }),
    );
  }

  getTransactions(envelopeId: string): Observable<EnvelopeTransaction[]> {
    return this.decryptTransactions(this.api.get<ApiRow[]>(`/envelopes/${envelopeId}/transactions`));
  }

  getAllTransactions(): Observable<EnvelopeTransaction[]> {
    return this.decryptTransactions(this.api.get<ApiRow[]>('/envelopes/transactions/all'));
  }

  private decryptTransactions(rows$: Observable<ApiRow[]>): Observable<EnvelopeTransaction[]> {
    return rows$.pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows.some((r) => r.encryptedData)) return from([rows as EnvelopeTransaction[]]);
        return from(decryptEntities<EnvelopeTransaction>(rows, key));
      }),
    );
  }

  addTransaction(envelopeId: string, data: { amount: number; date: string; note: string | null }): Observable<EnvelopeTransaction> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.post(`/envelopes/${envelopeId}/transactions`, data);

    return from(encryptEntity(data as Record<string, unknown>, TX_CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.post<ApiRow>(`/envelopes/${envelopeId}/transactions`, encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<EnvelopeTransaction>(row, key)) : from([row as EnvelopeTransaction])),
    );
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/envelopes/${id}`);
  }
}
