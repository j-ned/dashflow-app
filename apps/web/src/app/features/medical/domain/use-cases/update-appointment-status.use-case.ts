import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Appointment, AppointmentStatus } from '../models/appointment.model';
import { AppointmentGateway } from '../gateways/appointment.gateway';

@Injectable({ providedIn: 'root' })
export class UpdateAppointmentStatusUseCase {
  private readonly gateway = inject(AppointmentGateway);

  execute(id: string, status: AppointmentStatus): Observable<Appointment> {
    return this.gateway.updateStatus(id, status);
  }
}
