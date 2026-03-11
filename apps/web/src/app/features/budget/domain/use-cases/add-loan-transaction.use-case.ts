import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { LoanTransaction } from '../models/loan-transaction.model';
import { LoanGateway } from '../gateways/loan.gateway';

@Injectable({ providedIn: 'root' })
export class AddLoanTransactionUseCase {
  private readonly gateway = inject(LoanGateway);

  execute(loanId: string, data: { amount: number; date: string }): Observable<LoanTransaction> {
    return this.gateway.addTransaction(loanId, data);
  }
}
