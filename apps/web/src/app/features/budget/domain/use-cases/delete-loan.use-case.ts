import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { LoanGateway } from '../gateways/loan.gateway';

@Injectable({ providedIn: 'root' })
export class DeleteLoanUseCase {
  private readonly gateway = inject(LoanGateway);

  execute(id: string): Observable<void> {
    return this.gateway.delete(id);
  }
}
