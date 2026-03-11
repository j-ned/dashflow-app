import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Reminder } from '../models/reminder.model';
import { ReminderGateway } from '../gateways/reminder.gateway';

@Injectable({ providedIn: 'root' })
export class UpdateReminderUseCase {
  private readonly gateway = inject(ReminderGateway);

  execute(id: string, data: Partial<Omit<Reminder, 'id'>>): Observable<Reminder> {
    return this.gateway.update(id, data);
  }
}
