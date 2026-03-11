import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Patient } from '../models/patient.model';
import { PatientGateway } from '../gateways/patient.gateway';

@Injectable({ providedIn: 'root' })
export class GetPatientsUseCase {
  private readonly gateway = inject(PatientGateway);

  execute(): Observable<Patient[]> {
    return this.gateway.getAll();
  }
}
