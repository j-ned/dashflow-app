import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { Reminder } from '../domain/models/reminder.model';
import { ReminderGateway } from '../domain/gateways/reminder.gateway';

// Non-E2EE intentionnel : un rappel ne porte que sa cible (FK medication/appointment) et son état,
// soit ce que le serveur voit déjà pour toute ligne chiffrée. Aucun contenu médical, aucun e-mail.
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
