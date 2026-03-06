import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ConsumableGateway } from '../gateways/consumable.gateway';

@Injectable({ providedIn: 'root' })
export class DeleteConsumableUseCase {
  private readonly gateway = inject(ConsumableGateway);

  execute(id: string): Observable<void> {
    return this.gateway.delete(id);
  }
}
