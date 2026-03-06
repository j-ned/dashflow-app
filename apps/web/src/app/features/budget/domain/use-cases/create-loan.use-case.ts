import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Loan } from '../models/loan.model';
import { LoanGateway } from '../gateways/loan.gateway';

@Injectable({ providedIn: 'root' })
export class CreateLoanUseCase {
  private readonly gateway = inject(LoanGateway);

  execute(data: Omit<Loan, 'id'>): Observable<Loan> {
    return this.gateway.create(data);
  }
}
