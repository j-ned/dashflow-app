import { inject, Injectable } from '@angular/core';
import { from, Observable, switchMap } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { ApiRow, encryptEntity } from '@core/services/crypto/entity-crypto';
import { decryptList, mutateEncrypted } from '@core/services/crypto/crypto-transport';
import { AccountTransaction } from '../domain/models/account-transaction.model';
import { AccountTransactionGateway } from '../domain/gateways/account-transaction.gateway';

const CLEARTEXT_KEYS = [
  'id',
  'userId',
  'accountId',
  'toAccountId',
  'direction',
  'memberId',
  'recurringEntryId',
  'createdAt',
] as const;

function coerceTransaction(row: ApiRow): AccountTransaction {
  const t = row as unknown as AccountTransaction;
  return { ...t, amount: Number(t.amount) };
}

@Injectable()
export class HttpAccountTransactionGateway implements AccountTransactionGateway {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  getForAccount(accountId: string): Observable<AccountTransaction[]> {
    return decryptList(
      this.api.get<ApiRow[]>(`/bank-accounts/${accountId}/transactions`),
      this.crypto.getMasterKey(),
      coerceTransaction,
    );
  }

  getAll(): Observable<AccountTransaction[]> {
    return decryptList(
      this.api.get<ApiRow[]>('/transactions/all'),
      this.crypto.getMasterKey(),
      coerceTransaction,
    );
  }

  create(
    accountId: string,
    data: Omit<AccountTransaction, 'id' | 'accountId'>,
  ): Observable<AccountTransaction> {
    return mutateEncrypted(
      data as Record<string, unknown>,
      CLEARTEXT_KEYS,
      this.crypto.getMasterKey(),
      (body) => this.api.post<ApiRow>(`/bank-accounts/${accountId}/transactions`, body),
    );
  }

  update(
    id: string,
    data: Partial<Omit<AccountTransaction, 'id'>>,
  ): Observable<AccountTransaction> {
    return mutateEncrypted(
      data as Record<string, unknown>,
      CLEARTEXT_KEYS,
      this.crypto.getMasterKey(),
      (body) => this.api.put<ApiRow>(`/transactions/${id}`, body),
    );
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/transactions/${id}`);
  }

  createBatch(
    accountId: string,
    items: Omit<AccountTransaction, 'id' | 'accountId'>[],
  ): Observable<AccountTransaction[]> {
    const key = this.crypto.getMasterKey();
    const url = `/bank-accounts/${accountId}/transactions/batch`;
    if (!key) return this.api.post<AccountTransaction[]>(url, { items });
    return from(
      Promise.all(
        items.map((it) => encryptEntity(it as Record<string, unknown>, CLEARTEXT_KEYS, key)),
      ),
    ).pipe(
      switchMap((encrypted) => this.api.post<AccountTransaction[]>(url, { items: encrypted })),
    );
  }
}
