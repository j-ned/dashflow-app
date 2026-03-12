import { inject, Injectable } from '@angular/core';
import { from, Observable, switchMap } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { encryptEntity, decryptEntities, decryptEntity } from '@core/services/crypto/entity-crypto';
import { BankAccount } from '../domain/models/bank-account.model';
import { BankAccountGateway } from '../domain/gateways/bank-account.gateway';

const CLEARTEXT_KEYS = ['id', 'userId', 'createdAt'] as const;

@Injectable()
export class HttpBankAccountGateway implements BankAccountGateway {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  getAll(): Observable<BankAccount[]> {
    return this.api.get<any[]>('/bank-accounts').pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows as BankAccount[]]);
        return from(decryptEntities<BankAccount>(rows, key));
      }),
    );
  }

  create(data: Omit<BankAccount, 'id'>): Observable<BankAccount> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.post('/bank-accounts', data);

    return from(encryptEntity(data as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.post<any>('/bank-accounts', encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<BankAccount>(row, key)) : from([row as BankAccount])),
    );
  }

  update(id: string, data: Partial<Omit<BankAccount, 'id'>>): Observable<BankAccount> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.put(`/bank-accounts/${id}`, data);

    return from(encryptEntity(data as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.put<any>(`/bank-accounts/${id}`, encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<BankAccount>(row, key)) : from([row as BankAccount])),
    );
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/bank-accounts/${id}`);
  }
}
