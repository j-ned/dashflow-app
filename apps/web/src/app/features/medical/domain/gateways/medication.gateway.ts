import { Observable } from 'rxjs';
import { Medication, MedicationWithStock } from '../models/medication.model';

export abstract class MedicationGateway {
  abstract getAll(): Observable<Medication[]>;
  abstract getById(id: string): Observable<Medication>;
  abstract getAlerts(): Observable<MedicationWithStock[]>;
  abstract create(data: Omit<Medication, 'id'>): Observable<Medication>;
  abstract update(id: string, data: Partial<Omit<Medication, 'id'>>): Observable<Medication>;
  /** Ajoute `quantity` au stock. En E2EE le serveur ne peut pas additionner dans le blob : le
   *  médicament complet est renvoyé rechiffré, d'où l'objet et pas seulement l'id. */
  abstract refill(medication: Medication, quantity: number): Observable<Medication>;
  abstract delete(id: string): Observable<void>;
}
