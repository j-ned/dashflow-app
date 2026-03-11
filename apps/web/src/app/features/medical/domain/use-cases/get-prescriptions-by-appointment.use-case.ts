import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Prescription } from '../models/prescription.model';
import { PrescriptionGateway } from '../gateways/prescription.gateway';

@Injectable({ providedIn: 'root' })
export class GetPrescriptionsByAppointmentUseCase {
  private readonly gateway = inject(PrescriptionGateway);

  execute(appointmentId: string): Observable<Prescription[]> {
    return this.gateway.getByAppointment(appointmentId);
  }
}
