import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Medication } from '../models/medication.model';
import { MedicationGateway } from '../gateways/medication.gateway';

@Injectable({ providedIn: 'root' })
export class CreateMedicationUseCase {
  private readonly gateway = inject(MedicationGateway);

  execute(data: Omit<Medication, 'id'>): Observable<Medication> {
    return this.gateway.create(data);
  }
}
