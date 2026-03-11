import { Observable } from 'rxjs';
import { RecurringEntry } from '../models/recurring-entry.model';

export abstract class RecurringEntryGateway {
  abstract getAll(): Observable<RecurringEntry[]>;
  abstract create(data: Omit<RecurringEntry, 'id'>): Observable<RecurringEntry>;
  abstract update(id: string, data: Partial<Omit<RecurringEntry, 'id'>>): Observable<RecurringEntry>;
  abstract delete(id: string): Observable<void>;
  abstract uploadPayslip(id: string, file: File): Observable<RecurringEntry>;
  abstract downloadPayslip(id: string): Observable<Blob>;
  abstract deletePayslip(id: string): Observable<void>;
}
