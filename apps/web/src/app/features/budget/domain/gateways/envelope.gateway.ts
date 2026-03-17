import { Observable } from 'rxjs';
import { Envelope } from '../models/envelope.model';
import { EnvelopeTransaction } from '../models/envelope-transaction.model';

export abstract class EnvelopeGateway {
  abstract getAll(): Observable<Envelope[]>;
  abstract getById(id: string): Observable<Envelope>;
  abstract create(data: Omit<Envelope, 'id'>): Observable<Envelope>;
  abstract updateBalance(id: string, amount: number, date: string, envelope?: Envelope): Observable<Envelope>;
  abstract getTransactions(envelopeId: string): Observable<EnvelopeTransaction[]>;
  abstract addTransaction(envelopeId: string, data: { amount: number; date: string }): Observable<EnvelopeTransaction>;
  abstract update(id: string, data: Partial<Omit<Envelope, 'id'>>): Observable<Envelope>;
  abstract delete(id: string): Observable<void>;
}
