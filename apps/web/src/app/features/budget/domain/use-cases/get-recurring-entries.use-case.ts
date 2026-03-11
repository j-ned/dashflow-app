import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RecurringEntry } from '../models/recurring-entry.model';
import { RecurringEntryGateway } from '../gateways/recurring-entry.gateway';

@Injectable({ providedIn: 'root' })
export class GetRecurringEntriesUseCase {
  private readonly gateway = inject(RecurringEntryGateway);

  execute(): Observable<RecurringEntry[]> {
    return this.gateway.getAll();
  }
}
