import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BankAccountGateway } from '../gateways/bank-account.gateway';

@Injectable({ providedIn: 'root' })
export class DeleteBankAccountUseCase {
  private readonly gateway = inject(BankAccountGateway);

  execute(id: string): Observable<void> {
    return this.gateway.delete(id);
  }
}
