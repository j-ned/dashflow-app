import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Medication } from '../models/medication.model';
import { MedicationGateway } from '../gateways/medication.gateway';

@Injectable({ providedIn: 'root' })
export class GetMedicationsUseCase {
  private readonly gateway = inject(MedicationGateway);

  execute(): Observable<Medication[]> {
    return this.gateway.getAll();
  }
}
