import { Observable } from 'rxjs';
import { Prescription } from '../models/prescription.model';

export abstract class PrescriptionGateway {
  abstract getAll(): Observable<Prescription[]>;
  abstract getById(id: string): Observable<Prescription>;
  abstract getByAppointment(appointmentId: string): Observable<Prescription[]>;
  abstract create(data: Omit<Prescription, 'id' | 'documentUrl'>): Observable<Prescription>;
  abstract update(id: string, data: Partial<Omit<Prescription, 'id' | 'documentUrl'>>): Observable<Prescription>;
  abstract uploadDocument(id: string, file: File): Observable<Prescription>;
  abstract downloadDocument(id: string): Observable<Blob>;
  abstract deleteDocument(id: string): Observable<void>;
  abstract delete(id: string): Observable<void>;
}
