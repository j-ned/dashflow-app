import { Observable } from 'rxjs';
import { Loan } from '../models/loan.model';

export abstract class LoanGateway {
  abstract getAll(): Observable<Loan[]>;
  abstract getById(id: string): Observable<Loan>;
  abstract create(data: Omit<Loan, 'id'>): Observable<Loan>;
  abstract recordPayment(id: string, amount: number): Observable<Loan>;
  abstract update(id: string, data: Partial<Omit<Loan, 'id'>>): Observable<Loan>;
  abstract delete(id: string): Observable<void>;
}
