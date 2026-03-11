import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BankAccount } from '../models/bank-account.model';
import { BankAccountGateway } from '../gateways/bank-account.gateway';

@Injectable({ providedIn: 'root' })
export class UpdateBankAccountUseCase {
  private readonly gateway = inject(BankAccountGateway);

  execute(id: string, data: Partial<Omit<BankAccount, 'id'>>): Observable<BankAccount> {
    return this.gateway.update(id, data);
  }
}
