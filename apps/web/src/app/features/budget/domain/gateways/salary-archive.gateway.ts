import { Observable } from 'rxjs';
import { SalaryArchive } from '../models/salary-archive.model';

export abstract class SalaryArchiveGateway {
  abstract getAll(): Observable<SalaryArchive[]>;
  abstract create(data: FormData): Observable<SalaryArchive>;
  abstract delete(id: string): Observable<void>;
  abstract downloadPayslip(id: string): Observable<Blob>;
}
