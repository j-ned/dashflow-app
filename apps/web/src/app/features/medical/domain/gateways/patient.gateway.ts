import { Observable } from 'rxjs';
import { Patient } from '../models/patient.model';

export abstract class PatientGateway {
  abstract getAll(): Observable<Patient[]>;
  abstract getById(id: string): Observable<Patient>;
  abstract create(data: Omit<Patient, 'id'>): Observable<Patient>;
  abstract update(id: string, data: Partial<Omit<Patient, 'id'>>): Observable<Patient>;
  abstract delete(id: string): Observable<void>;
}
