import { Observable } from 'rxjs';
import { Quote, QuoteStatus } from '../models/quote.model';

export abstract class QuoteGateway {
  abstract getAll(): Observable<Quote[]>;
  abstract getById(id: string): Observable<Quote>;
  abstract create(data: Omit<Quote, 'id' | 'reference'>): Observable<Quote>;
  abstract updateStatus(id: string, status: QuoteStatus): Observable<Quote>;
  abstract delete(id: string): Observable<void>;
}
