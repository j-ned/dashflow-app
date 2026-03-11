import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Medication } from '../models/medication.model';
import { MedicationGateway } from '../gateways/medication.gateway';

@Injectable({ providedIn: 'root' })
export class GetMedicationUseCase {
  private readonly gateway = inject(MedicationGateway);

  execute(id: string): Observable<Medication> {
    return this.gateway.getById(id);
  }
}
