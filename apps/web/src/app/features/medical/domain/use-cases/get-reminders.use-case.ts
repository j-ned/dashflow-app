import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Reminder } from '../models/reminder.model';
import { ReminderGateway } from '../gateways/reminder.gateway';

@Injectable({ providedIn: 'root' })
export class GetRemindersUseCase {
  private readonly gateway = inject(ReminderGateway);

  execute(): Observable<Reminder[]> {
    return this.gateway.getAll();
  }
}
