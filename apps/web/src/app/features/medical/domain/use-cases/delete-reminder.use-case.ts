import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ReminderGateway } from '../gateways/reminder.gateway';

@Injectable({ providedIn: 'root' })
export class DeleteReminderUseCase {
  private readonly gateway = inject(ReminderGateway);

  execute(id: string): Observable<void> {
    return this.gateway.delete(id);
  }
}
