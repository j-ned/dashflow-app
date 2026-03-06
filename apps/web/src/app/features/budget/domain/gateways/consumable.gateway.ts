import { Observable } from 'rxjs';
import { Consumable } from '../models/consumable.model';

export abstract class ConsumableGateway {
  abstract getAll(): Observable<Consumable[]>;
  abstract getById(id: string): Observable<Consumable>;
  abstract create(data: Omit<Consumable, 'id'>): Observable<Consumable>;
  abstract updateQuantity(id: string, quantity: number): Observable<Consumable>;
  abstract install(id: string, installedAt: string, estimatedLifetimeDays: number): Observable<Consumable>;
  abstract update(id: string, data: Partial<Omit<Consumable, 'id'>>): Observable<Consumable>;
  abstract delete(id: string): Observable<void>;
}
