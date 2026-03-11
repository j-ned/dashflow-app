import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MedicationWithStock } from '../models/medication.model';
import { MedicationGateway } from '../gateways/medication.gateway';

@Injectable({ providedIn: 'root' })
export class GetMedicationAlertsUseCase {
  private readonly gateway = inject(MedicationGateway);

  execute(): Observable<MedicationWithStock[]> {
    return this.gateway.getAlerts();
  }
}
