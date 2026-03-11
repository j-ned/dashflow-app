import { Observable } from 'rxjs';
import { Medication, MedicationWithStock } from '../models/medication.model';

export abstract class MedicationGateway {
  abstract getAll(): Observable<Medication[]>;
  abstract getById(id: string): Observable<Medication>;
  abstract getAlerts(): Observable<MedicationWithStock[]>;
  abstract create(data: Omit<Medication, 'id'>): Observable<Medication>;
  abstract update(id: string, data: Partial<Omit<Medication, 'id'>>): Observable<Medication>;
  abstract refill(id: string, quantity: number): Observable<Medication>;
  abstract delete(id: string): Observable<void>;
}
