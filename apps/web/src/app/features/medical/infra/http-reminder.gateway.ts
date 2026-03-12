import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { Reminder } from '../domain/models/reminder.model';
import { ReminderGateway } from '../domain/gateways/reminder.gateway';

@Injectable()
export class HttpReminderGateway implements ReminderGateway {
  private readonly api = inject(ApiClient);

  getAll(): Observable<Reminder[]> {
    return this.api.get('/reminders');
  }

  getById(id: string): Observable<Reminder> {
    return this.api.get(`/reminders/${id}`);
  }

  create(data: Omit<Reminder, 'id'>): Observable<Reminder> {
    return this.api.post('/reminders', data);
  }

  update(id: string, data: Partial<Omit<Reminder, 'id'>>): Observable<Reminder> {
    return this.api.put(`/reminders/${id}`, data);
  }

  toggle(id: string): Observable<Reminder> {
    return this.api.patch(`/reminders/${id}/toggle`, {});
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/reminders/${id}`);
  }
}
