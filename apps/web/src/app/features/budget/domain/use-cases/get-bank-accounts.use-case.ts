import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BankAccount } from '../models/bank-account.model';
import { BankAccountGateway } from '../gateways/bank-account.gateway';

@Injectable({ providedIn: 'root' })
export class GetBankAccountsUseCase {
  private readonly gateway = inject(BankAccountGateway);

  execute(): Observable<BankAccount[]> {
    return this.gateway.getAll();
  }
}
