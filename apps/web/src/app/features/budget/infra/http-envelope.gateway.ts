import { inject, Injectable } from '@angular/core';
import { map, Observable, switchMap } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { ApiRow } from '@core/services/crypto/entity-crypto';
import { decryptList, decryptOne, mutateEncrypted } from '@core/services/crypto/crypto-transport';
import { Envelope } from '../domain/models/envelope.model';
import { EnvelopeTransaction } from '../domain/models/envelope-transaction.model';
import { EnvelopeGateway } from '../domain/gateways/envelope.gateway';
import { addMoney } from '../domain/money';

const CLEARTEXT_KEYS = ['id', 'userId', 'memberId'] as const;
const TX_CLEARTEXT_KEYS = ['id', 'envelopeId', 'createdAt'] as const;

// Données en clair (compte démo / non-E2EE) : postgres renvoie les numériques en string.
// On les coerce comme le fait la voie déchiffrée, sinon les additions concatènent.
function coerceEnvelope(row: ApiRow): Envelope {
  const e = row as unknown as Envelope;
  return {
    ...e,
    balance: Number(e.balance),
    target: e.target == null ? null : Number(e.target),
    dueDay: e.dueDay == null ? null : Number(e.dueDay),
  };
}

@Injectable()
export class HttpEnvelopeGateway implements EnvelopeGateway {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  getAll(): Observable<Envelope[]> {
    return decryptList(
      this.api.get<ApiRow[]>('/envelopes'),
      this.crypto.getMasterKey(),
      coerceEnvelope,
    );
  }

  getById(id: string): Observable<Envelope> {
    return decryptOne(
      this.api.get<ApiRow>(`/envelopes/${id}`),
      this.crypto.getMasterKey(),
      coerceEnvelope,
    );
  }

  create(data: Omit<Envelope, 'id'>): Observable<Envelope> {
    return mutateEncrypted(
      data as Record<string, unknown>,
      CLEARTEXT_KEYS,
      this.crypto.getMasterKey(),
      (body) => this.api.post<ApiRow>('/envelopes', body),
    );
  }

  update(id: string, data: Partial<Omit<Envelope, 'id'>>): Observable<Envelope> {
    return mutateEncrypted(
      data as Record<string, unknown>,
      CLEARTEXT_KEYS,
      this.crypto.getMasterKey(),
      (body) => this.api.put<ApiRow>(`/envelopes/${id}`, body),
    );
  }

  updateBalance(
    id: string,
    amount: number,
    date: string,
    note: string | null,
    envelope: Envelope,
  ): Observable<Envelope> {
    const key = this.crypto.getMasterKey();

    // Plaintext: the /balance endpoint updates the balance and records the transaction.
    if (!key) return this.api.patch(`/envelopes/${id}/balance`, { amount, date, note });

    // E2EE: recompute balance client-side and re-encrypt the full envelope (PUT),
    // then record the movement as its own encrypted transaction so history stays real.
    const updatedEnvelope: Partial<Omit<Envelope, 'id'>> = {
      memberId: envelope.memberId,
      name: envelope.name,
      type: envelope.type,
      balance: addMoney(Number(envelope.balance), amount),
      target: envelope.target,
      color: envelope.color,
      dueDay: envelope.dueDay,
    };

    return this.update(id, updatedEnvelope).pipe(
      switchMap((updated) =>
        this.addTransaction(id, { amount, date, note }).pipe(map(() => updated)),
      ),
    );
  }

  getTransactions(envelopeId: string): Observable<EnvelopeTransaction[]> {
    return decryptList(
      this.api.get<ApiRow[]>(`/envelopes/${envelopeId}/transactions`),
      this.crypto.getMasterKey(),
    );
  }

  getAllTransactions(): Observable<EnvelopeTransaction[]> {
    return decryptList(
      this.api.get<ApiRow[]>('/envelopes/transactions/all'),
      this.crypto.getMasterKey(),
    );
  }

  addTransaction(
    envelopeId: string,
    data: { amount: number; date: string; note: string | null },
  ): Observable<EnvelopeTransaction> {
    return mutateEncrypted(
      data as Record<string, unknown>,
      TX_CLEARTEXT_KEYS,
      this.crypto.getMasterKey(),
      (body) => this.api.post<ApiRow>(`/envelopes/${envelopeId}/transactions`, body),
    );
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/envelopes/${id}`);
  }
}
