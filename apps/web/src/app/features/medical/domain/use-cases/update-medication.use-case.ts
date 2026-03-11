import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Medication } from '../models/medication.model';
import { MedicationGateway } from '../gateways/medication.gateway';

@Injectable({ providedIn: 'root' })
export class UpdateMedicationUseCase {
  private readonly gateway = inject(MedicationGateway);

  execute(id: string, data: Partial<Omit<Medication, 'id'>>): Observable<Medication> {
    return this.gateway.update(id, data);
  }
}
