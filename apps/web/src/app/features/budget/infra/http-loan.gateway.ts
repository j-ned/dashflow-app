import { inject, Injectable } from '@angular/core';
import { map, Observable, switchMap } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { ApiRow } from '@core/services/crypto/entity-crypto';
import { decryptList, decryptOne, mutateEncrypted } from '@core/services/crypto/crypto-transport';
import { Loan } from '../domain/models/loan.model';
import { LoanTransaction } from '../domain/models/loan-transaction.model';
import { LoanGateway } from '../domain/gateways/loan.gateway';

const CLEARTEXT_KEYS = ['id', 'userId', 'memberId', 'direction'] as const;
const TX_CLEARTEXT_KEYS = ['id', 'loanId', 'createdAt'] as const;

// Données en clair (compte démo / non-E2EE) : postgres renvoie les numériques en string.
// On les coerce comme la voie déchiffrée, sinon les additions (totaux) concatènent.
function coerceLoan(row: ApiRow): Loan {
  const l = row as unknown as Loan;
  return {
    ...l,
    amount: Number(l.amount),
    remaining: Number(l.remaining),
    dueDay: l.dueDay == null ? null : Number(l.dueDay),
  };
}

@Injectable()
export class HttpLoanGateway implements LoanGateway {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  getAll(): Observable<Loan[]> {
    return decryptList(this.api.get<ApiRow[]>('/loans'), this.crypto.getMasterKey(), coerceLoan);
  }

  getById(id: string): Observable<Loan> {
    return decryptOne(this.api.get<ApiRow>(`/loans/${id}`), this.crypto.getMasterKey(), coerceLoan);
  }

  create(data: Omit<Loan, 'id'>): Observable<Loan> {
    return mutateEncrypted(data as Record<string, unknown>, CLEARTEXT_KEYS, this.crypto.getMasterKey(),
      (body) => this.api.post<ApiRow>('/loans', body));
  }

  update(id: string, data: Partial<Omit<Loan, 'id'>>): Observable<Loan> {
    return mutateEncrypted(data as Record<string, unknown>, CLEARTEXT_KEYS, this.crypto.getMasterKey(),
      (body) => this.api.put<ApiRow>(`/loans/${id}`, body));
  }

  recordPayment(id: string, amount: number, date: string): Observable<Loan> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.patch(`/loans/${id}/payment`, { amount, date });

    // With E2EE, backend can't read remaining/amount from encryptedData.
    // Compute new remaining client-side, then update full loan + add transaction.
    return this.getById(id).pipe(
      switchMap((loan) => {
        const newRemaining = Math.max(0, loan.remaining - amount);
        const { id: _, ...loanData } = loan;
        return this.update(id, { ...loanData, remaining: newRemaining }).pipe(
          switchMap((updated) => this.addTransaction(id, { amount, date }).pipe(map(() => updated))),
        );
      }),
    );
  }

  getTransactions(loanId: string): Observable<LoanTransaction[]> {
    return decryptList(this.api.get<ApiRow[]>(`/loans/${loanId}/transactions`), this.crypto.getMasterKey());
  }

  getAllTransactions(): Observable<LoanTransaction[]> {
    return decryptList(this.api.get<ApiRow[]>('/loans/transactions/all'), this.crypto.getMasterKey());
  }

  addTransaction(loanId: string, data: { amount: number; date: string }): Observable<LoanTransaction> {
    return mutateEncrypted(data as Record<string, unknown>, TX_CLEARTEXT_KEYS, this.crypto.getMasterKey(),
      (body) => this.api.post<ApiRow>(`/loans/${loanId}/transactions`, body));
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/loans/${id}`);
  }
}
