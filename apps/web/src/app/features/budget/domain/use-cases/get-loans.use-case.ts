import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Loan } from '../models/loan.model';
import { LoanGateway } from '../gateways/loan.gateway';

@Injectable({ providedIn: 'root' })
export class GetLoansUseCase {
  private readonly gateway = inject(LoanGateway);

  execute(): Observable<Loan[]> {
    return this.gateway.getAll();
  }
}
