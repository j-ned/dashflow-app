import { Observable } from 'rxjs';
import { FiscalPeriod } from '../models/fiscal-period.model';

export abstract class FiscalGateway {
  abstract getAll(): Observable<FiscalPeriod[]>;
  abstract getByQuarter(year: number, quarter: string): Observable<FiscalPeriod>;
  abstract updateProvision(id: string, amount: number): Observable<FiscalPeriod>;
  abstract markDeclared(id: string): Observable<FiscalPeriod>;
}
