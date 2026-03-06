import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Consumable } from '../models/consumable.model';
import { ConsumableGateway } from '../gateways/consumable.gateway';

@Injectable({ providedIn: 'root' })
export class InstallConsumableUseCase {
  private readonly gateway = inject(ConsumableGateway);

  execute(id: string, installedAt: string, estimatedLifetimeDays: number): Observable<Consumable> {
    return this.gateway.install(id, installedAt, estimatedLifetimeDays);
  }
}
