import { Observable } from 'rxjs';
import { Loan } from '../models/loan.model';
import { LoanTransaction } from '../models/loan-transaction.model';

export abstract class LoanGateway {
  abstract getAll(): Observable<Loan[]>;
  abstract getById(id: string): Observable<Loan>;
  abstract create(data: Omit<Loan, 'id'>): Observable<Loan>;
  abstract recordPayment(id: string, amount: number, date: string): Observable<Loan>;
  abstract getTransactions(loanId: string): Observable<LoanTransaction[]>;
  abstract addTransaction(loanId: string, data: { amount: number; date: string }): Observable<LoanTransaction>;
  abstract update(id: string, data: Partial<Omit<Loan, 'id'>>): Observable<Loan>;
  abstract delete(id: string): Observable<void>;
}
