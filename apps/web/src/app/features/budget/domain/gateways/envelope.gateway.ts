import { Observable } from 'rxjs';
import { Envelope } from '../models/envelope.model';

export abstract class EnvelopeGateway {
  abstract getAll(): Observable<Envelope[]>;
  abstract getById(id: string): Observable<Envelope>;
  abstract create(data: Omit<Envelope, 'id'>): Observable<Envelope>;
  abstract updateBalance(id: string, amount: number): Observable<Envelope>;
  abstract update(id: string, data: Partial<Omit<Envelope, 'id'>>): Observable<Envelope>;
  abstract delete(id: string): Observable<void>;
}
