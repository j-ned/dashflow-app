import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Appointment } from '../models/appointment.model';
import { AppointmentGateway } from '../gateways/appointment.gateway';

@Injectable({ providedIn: 'root' })
export class UpdateAppointmentUseCase {
  private readonly gateway = inject(AppointmentGateway);

  execute(id: string, data: Partial<Omit<Appointment, 'id'>>): Observable<Appointment> {
    return this.gateway.update(id, data);
  }
}
