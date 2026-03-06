import { Observable } from 'rxjs';
import { Invoice, InvoiceStatus } from '../models/invoice.model';

export abstract class InvoiceGateway {
  abstract getAll(): Observable<Invoice[]>;
  abstract getById(id: string): Observable<Invoice>;
  abstract create(data: Omit<Invoice, 'id' | 'reference' | 'paidAt'>): Observable<Invoice>;
  abstract updateStatus(id: string, status: InvoiceStatus): Observable<Invoice>;
  abstract delete(id: string): Observable<void>;
}
