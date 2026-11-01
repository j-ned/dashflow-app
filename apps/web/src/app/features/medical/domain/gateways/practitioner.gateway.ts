import { Observable } from 'rxjs';
import { Practitioner } from '../models/practitioner.model';

export abstract class PractitionerGateway {
  abstract getAll(): Observable<Practitioner[]>;
  abstract getById(id: string): Observable<Practitioner>;
  abstract create(data: Omit<Practitioner, 'id'>): Observable<Practitioner>;
  abstract update(id: string, data: Partial<Omit<Practitioner, 'id'>>): Observable<Practitioner>;
  abstract delete(id: string): Observable<void>;
}
