import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { LoanTransaction } from '../models/loan-transaction.model';
import { LoanGateway } from '../gateways/loan.gateway';

@Injectable({ providedIn: 'root' })
export class GetAllLoanTransactionsUseCase {
  private readonly gateway = inject(LoanGateway);

  execute(): Observable<LoanTransaction[]> {
    return this.gateway.getAllTransactions();
  }
}
