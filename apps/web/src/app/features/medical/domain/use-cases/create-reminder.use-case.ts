import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Reminder } from '../models/reminder.model';
import { ReminderGateway } from '../gateways/reminder.gateway';

@Injectable({ providedIn: 'root' })
export class CreateReminderUseCase {
  private readonly gateway = inject(ReminderGateway);

  execute(data: Omit<Reminder, 'id'>): Observable<Reminder> {
    return this.gateway.create(data);
  }
}
