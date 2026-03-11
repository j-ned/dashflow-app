import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RecurringEntryGateway } from '../gateways/recurring-entry.gateway';

@Injectable({ providedIn: 'root' })
export class DeleteRecurringEntryUseCase {
  private readonly gateway = inject(RecurringEntryGateway);

  execute(id: string): Observable<void> {
    return this.gateway.delete(id);
  }
}
