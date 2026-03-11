import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Loan } from '../models/loan.model';
import { LoanGateway } from '../gateways/loan.gateway';

@Injectable({ providedIn: 'root' })
export class RecordLoanPaymentUseCase {
  private readonly gateway = inject(LoanGateway);

  execute(id: string, amount: number, date: string): Observable<Loan> {
    return this.gateway.recordPayment(id, amount, date);
  }
}
