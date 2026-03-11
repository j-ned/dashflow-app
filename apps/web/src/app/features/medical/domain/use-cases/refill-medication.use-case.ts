import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Medication } from '../models/medication.model';
import { MedicationGateway } from '../gateways/medication.gateway';

@Injectable({ providedIn: 'root' })
export class RefillMedicationUseCase {
  private readonly gateway = inject(MedicationGateway);

  execute(id: string, quantity: number): Observable<Medication> {
    return this.gateway.refill(id, quantity);
  }
}
