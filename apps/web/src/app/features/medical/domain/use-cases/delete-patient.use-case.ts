import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PatientGateway } from '../gateways/patient.gateway';

@Injectable({ providedIn: 'root' })
export class DeletePatientUseCase {
  private readonly gateway = inject(PatientGateway);

  execute(id: string): Observable<void> {
    return this.gateway.delete(id);
  }
}
