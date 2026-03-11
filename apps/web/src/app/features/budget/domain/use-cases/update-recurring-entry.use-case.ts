import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RecurringEntry } from '../models/recurring-entry.model';
import { RecurringEntryGateway } from '../gateways/recurring-entry.gateway';

@Injectable({ providedIn: 'root' })
export class UpdateRecurringEntryUseCase {
  private readonly gateway = inject(RecurringEntryGateway);

  execute(id: string, data: Partial<Omit<RecurringEntry, 'id'>>): Observable<RecurringEntry> {
    return this.gateway.update(id, data);
  }
}
