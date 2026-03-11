import { Observable } from 'rxjs';
import { MedicalDocument } from '../models/document.model';

export abstract class DocumentGateway {
  abstract getAll(): Observable<MedicalDocument[]>;
  abstract getById(id: string): Observable<MedicalDocument>;
  abstract getByPatient(patientId: string): Observable<MedicalDocument[]>;
  abstract create(data: Omit<MedicalDocument, 'id' | 'fileUrl'>): Observable<MedicalDocument>;
  abstract update(id: string, data: Partial<Omit<MedicalDocument, 'id' | 'fileUrl'>>): Observable<MedicalDocument>;
  abstract uploadFile(id: string, file: File): Observable<MedicalDocument>;
  abstract deleteFile(id: string): Observable<void>;
  abstract delete(id: string): Observable<void>;
}
