import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Patient } from '../models/patient.model';
import { PatientGateway } from '../gateways/patient.gateway';

@Injectable({ providedIn: 'root' })
export class UpdatePatientUseCase {
  private readonly gateway = inject(PatientGateway);

  execute(id: string, data: Partial<Omit<Patient, 'id'>>): Observable<Patient> {
    return this.gateway.update(id, data);
  }
}
