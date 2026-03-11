import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Appointment } from '../models/appointment.model';
import { AppointmentGateway } from '../gateways/appointment.gateway';

@Injectable({ providedIn: 'root' })
export class CreateAppointmentUseCase {
  private readonly gateway = inject(AppointmentGateway);

  execute(data: Omit<Appointment, 'id'>): Observable<Appointment> {
    return this.gateway.create(data);
  }
}
