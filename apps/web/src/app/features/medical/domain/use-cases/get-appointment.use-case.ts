import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Appointment } from '../models/appointment.model';
import { AppointmentGateway } from '../gateways/appointment.gateway';

@Injectable({ providedIn: 'root' })
export class GetAppointmentUseCase {
  private readonly gateway = inject(AppointmentGateway);

  execute(id: string): Observable<Appointment> {
    return this.gateway.getById(id);
  }
}
