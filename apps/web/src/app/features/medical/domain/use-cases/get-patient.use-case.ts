import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Patient } from '../models/patient.model';
import { PatientGateway } from '../gateways/patient.gateway';

@Injectable({ providedIn: 'root' })
export class GetPatientUseCase {
  private readonly gateway = inject(PatientGateway);

  execute(id: string): Observable<Patient> {
    return this.gateway.getById(id);
  }
}
