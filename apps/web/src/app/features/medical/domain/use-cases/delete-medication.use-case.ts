import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MedicationGateway } from '../gateways/medication.gateway';

@Injectable({ providedIn: 'root' })
export class DeleteMedicationUseCase {
  private readonly gateway = inject(MedicationGateway);

  execute(id: string): Observable<void> {
    return this.gateway.delete(id);
  }
}
