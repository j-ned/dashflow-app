import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { ApiRow } from '@core/services/crypto/entity-crypto';
import { decryptList, mutateEncrypted } from '@core/services/crypto/crypto-transport';
import { BankAccount, BankAccountType } from '../domain/models/bank-account.model';
import { BankAccountGateway } from '../domain/gateways/bank-account.gateway';

const CLEARTEXT_KEYS = ['id', 'userId', 'initialBalance', 'createdAt'] as const;

// `type` est chiffré : les comptes créés avant A3-type n'en ont pas → défaut 'courant'.
// initialBalance est en clair (numeric → string côté postgres) → coercition en number.
function coerceBankAccount(row: ApiRow): BankAccount {
  const a = row as Record<string, unknown>;
  return {
    ...(a as unknown as BankAccount),
    type: (a['type'] as BankAccountType) ?? 'courant',
    initialBalance: Number(a['initialBalance']),
  };
}

@Injectable()
export class HttpBankAccountGateway implements BankAccountGateway {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  getAll(): Observable<BankAccount[]> {
    // coerce appliqué APRÈS décryptage (decryptList ne mappe que le chemin plaintext) → vaut pour E2EE aussi.
    return decryptList<ApiRow>(
      this.api.get<ApiRow[]>('/bank-accounts'),
      this.crypto.getMasterKey(),
    ).pipe(map((rows) => rows.map(coerceBankAccount)));
  }

  create(data: Omit<BankAccount, 'id'>): Observable<BankAccount> {
    return mutateEncrypted(
      data as Record<string, unknown>,
      CLEARTEXT_KEYS,
      this.crypto.getMasterKey(),
      (body) => this.api.post<ApiRow>('/bank-accounts', body),
    );
  }

  update(id: string, data: Partial<Omit<BankAccount, 'id'>>): Observable<BankAccount> {
    return mutateEncrypted(
      data as Record<string, unknown>,
      CLEARTEXT_KEYS,
      this.crypto.getMasterKey(),
      (body) => this.api.put<ApiRow>(`/bank-accounts/${id}`, body),
    );
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/bank-accounts/${id}`);
  }
}
