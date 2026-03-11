import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RecurringEntry } from '../models/recurring-entry.model';
import { RecurringEntryGateway } from '../gateways/recurring-entry.gateway';

@Injectable({ providedIn: 'root' })
export class CreateRecurringEntryUseCase {
  private readonly gateway = inject(RecurringEntryGateway);

  execute(data: Omit<RecurringEntry, 'id'>): Observable<RecurringEntry> {
    return this.gateway.create(data);
  }
}
