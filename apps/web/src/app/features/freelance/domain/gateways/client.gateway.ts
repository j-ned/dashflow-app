import { Observable } from 'rxjs';
import { Client } from '../models/client.model';

export abstract class ClientGateway {
  abstract getAll(): Observable<Client[]>;
  abstract getById(id: string): Observable<Client>;
  abstract create(data: Omit<Client, 'id' | 'createdAt'>): Observable<Client>;
  abstract update(id: string, data: Partial<Client>): Observable<Client>;
  abstract delete(id: string): Observable<void>;
}
