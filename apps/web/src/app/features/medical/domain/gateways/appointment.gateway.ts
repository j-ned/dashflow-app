import { Observable } from 'rxjs';
import { Appointment, AppointmentStatus } from '../models/appointment.model';

export abstract class AppointmentGateway {
  abstract getAll(): Observable<Appointment[]>;
  abstract getById(id: string): Observable<Appointment>;
  abstract create(data: Omit<Appointment, 'id'>): Observable<Appointment>;
  abstract update(id: string, data: Partial<Omit<Appointment, 'id'>>): Observable<Appointment>;
  abstract updateStatus(
    appointment: Appointment,
    status: AppointmentStatus,
  ): Observable<Appointment>;
  abstract delete(id: string): Observable<void>;
}
