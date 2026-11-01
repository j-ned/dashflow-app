import { Observable } from 'rxjs';
import { SalaryArchive } from '../models/salary-archive.model';

export abstract class SalaryArchiveGateway {
  abstract getAll(): Observable<SalaryArchive[]>;
  abstract create(data: FormData): Observable<SalaryArchive>;
  /** Édite les champs d'une archive (salaire, charges, mois, compte) en conservant fiche de paie et dépenses. */
  abstract update(id: string, archive: SalaryArchive): Observable<SalaryArchive>;
  abstract delete(id: string): Observable<void>;
  abstract downloadPayslip(id: string): Observable<Blob>;
}
