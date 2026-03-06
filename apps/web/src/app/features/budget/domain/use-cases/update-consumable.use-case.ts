import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Consumable } from '../models/consumable.model';
import { ConsumableGateway } from '../gateways/consumable.gateway';

@Injectable({ providedIn: 'root' })
export class UpdateConsumableUseCase {
  private readonly gateway = inject(ConsumableGateway);

  execute(id: string, data: Partial<Omit<Consumable, 'id'>>): Observable<Consumable> {
    return this.gateway.update(id, data);
  }
}
