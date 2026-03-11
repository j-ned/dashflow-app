import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AppointmentGateway } from '../gateways/appointment.gateway';

@Injectable({ providedIn: 'root' })
export class DeleteAppointmentUseCase {
  private readonly gateway = inject(AppointmentGateway);

  execute(id: string): Observable<void> {
    return this.gateway.delete(id);
  }
}
