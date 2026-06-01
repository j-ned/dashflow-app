import { inject, Injectable } from '@angular/core';
import { from, map, Observable, switchMap } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { ApiRow, encryptEntity, decryptEntities, decryptEntity } from '@core/services/crypto/entity-crypto';
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
    return this.api.get<ApiRow[]>('/loans').pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows.map(coerceLoan)]);
        return from(decryptEntities<Loan>(rows, key));
      }),
    );
  }

  getById(id: string): Observable<Loan> {
    return this.api.get<ApiRow>(`/loans/${id}`).pipe(
      switchMap((row) => {
        const key = this.crypto.getMasterKey();
        if (!key || !row.encryptedData) return from([coerceLoan(row)]);
        return from(decryptEntity<Loan>(row, key));
      }),
    );
  }

  create(data: Omit<Loan, 'id'>): Observable<Loan> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.post('/loans', data);

    return from(encryptEntity(data as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.post<ApiRow>('/loans', encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<Loan>(row, key)) : from([row as Loan])),
    );
  }

  update(id: string, data: Partial<Omit<Loan, 'id'>>): Observable<Loan> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.put(`/loans/${id}`, data);

    return from(encryptEntity(data as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.put<ApiRow>(`/loans/${id}`, encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<Loan>(row, key)) : from([row as Loan])),
    );
  }

  recordPayment(id: string, amount: number, date: string): Observable<Loan> {
    const key = this.crypto.getMasterKey();
    const payload = { amount, date };
    if (!key) return this.api.patch(`/loans/${id}/payment`, payload);

    // With E2EE, backend can't read remaining/amount from encryptedData.
    // Compute new remaining client-side, then update full loan + add transaction.
    return this.getById(id).pipe(
      switchMap((loan) => {
        const newRemaining = Math.max(0, loan.remaining - amount);
        const { id: _, ...loanData } = loan;
        return this.update(id, { ...loanData, remaining: newRemaining }).pipe(
          switchMap((updated) =>
            this.addTransaction(id, { amount, date }).pipe(map(() => updated)),
          ),
        );
      }),
    );
  }

  getTransactions(loanId: string): Observable<LoanTransaction[]> {
    return this.decryptTransactions(this.api.get<ApiRow[]>(`/loans/${loanId}/transactions`));
  }

  getAllTransactions(): Observable<LoanTransaction[]> {
    return this.decryptTransactions(this.api.get<ApiRow[]>('/loans/transactions/all'));
  }

  private decryptTransactions(rows$: Observable<ApiRow[]>): Observable<LoanTransaction[]> {
    return rows$.pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows.some((r) => r.encryptedData)) return from([rows as LoanTransaction[]]);
        return from(decryptEntities<LoanTransaction>(rows, key));
      }),
    );
  }

  addTransaction(loanId: string, data: { amount: number; date: string }): Observable<LoanTransaction> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.post(`/loans/${loanId}/transactions`, data);

    return from(encryptEntity(data as Record<string, unknown>, TX_CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.post<ApiRow>(`/loans/${loanId}/transactions`, encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<LoanTransaction>(row, key)) : from([row as LoanTransaction])),
    );
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/loans/${id}`);
  }
}
