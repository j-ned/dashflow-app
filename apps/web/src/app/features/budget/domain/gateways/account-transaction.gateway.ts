import { Observable } from 'rxjs';
import { AccountTransaction } from '../models/account-transaction.model';

export abstract class AccountTransactionGateway {
  abstract getForAccount(accountId: string): Observable<AccountTransaction[]>;
  abstract getAll(): Observable<AccountTransaction[]>;
  abstract create(
    accountId: string,
    data: Omit<AccountTransaction, 'id' | 'accountId'>,
  ): Observable<AccountTransaction>;
  abstract update(
    id: string,
    data: Partial<Omit<AccountTransaction, 'id'>>,
  ): Observable<AccountTransaction>;
  abstract delete(id: string): Observable<void>;
  abstract createBatch(
    accountId: string,
    items: Omit<AccountTransaction, 'id' | 'accountId'>[],
  ): Observable<AccountTransaction[]>;
}
