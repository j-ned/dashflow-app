import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Consumable } from '../models/consumable.model';
import { ConsumableGateway } from '../gateways/consumable.gateway';

@Injectable({ providedIn: 'root' })
export class CreateConsumableUseCase {
  private readonly gateway = inject(ConsumableGateway);

  execute(data: Omit<Consumable, 'id'>): Observable<Consumable> {
    return this.gateway.create(data);
  }
}
