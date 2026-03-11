import { Observable } from 'rxjs';
import { BankAccount } from '../models/bank-account.model';

export abstract class BankAccountGateway {
  abstract getAll(): Observable<BankAccount[]>;
  abstract create(data: Omit<BankAccount, 'id'>): Observable<BankAccount>;
  abstract update(id: string, data: Partial<Omit<BankAccount, 'id'>>): Observable<BankAccount>;
  abstract delete(id: string): Observable<void>;
}
