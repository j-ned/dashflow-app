import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Loan } from '../models/loan.model';
import { LoanGateway } from '../gateways/loan.gateway';

@Injectable({ providedIn: 'root' })
export class UpdateLoanUseCase {
  private readonly gateway = inject(LoanGateway);

  execute(id: string, data: Partial<Omit<Loan, 'id'>>): Observable<Loan> {
    return this.gateway.update(id, data);
  }
}
