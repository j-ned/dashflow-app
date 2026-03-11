import { Observable } from 'rxjs';
import { Reminder } from '../models/reminder.model';

export abstract class ReminderGateway {
  abstract getAll(): Observable<Reminder[]>;
  abstract create(data: Omit<Reminder, 'id'>): Observable<Reminder>;
  abstract update(id: string, data: Partial<Omit<Reminder, 'id'>>): Observable<Reminder>;
  abstract toggle(id: string): Observable<Reminder>;
  abstract delete(id: string): Observable<void>;
}
