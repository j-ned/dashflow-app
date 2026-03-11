import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BankAccount } from '../models/bank-account.model';
import { BankAccountGateway } from '../gateways/bank-account.gateway';

@Injectable({ providedIn: 'root' })
export class CreateBankAccountUseCase {
  private readonly gateway = inject(BankAccountGateway);

  execute(data: Omit<BankAccount, 'id'>): Observable<BankAccount> {
    return this.gateway.create(data);
  }
}
