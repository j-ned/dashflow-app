import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Reminder } from '../models/reminder.model';
import { ReminderGateway } from '../gateways/reminder.gateway';

@Injectable({ providedIn: 'root' })
export class ToggleReminderUseCase {
  private readonly gateway = inject(ReminderGateway);

  execute(id: string): Observable<Reminder> {
    return this.gateway.toggle(id);
  }
}
