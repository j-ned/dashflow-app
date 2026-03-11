import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SalaryArchive } from '../models/salary-archive.model';
import { SalaryArchiveGateway } from '../gateways/salary-archive.gateway';

@Injectable({ providedIn: 'root' })
export class GetSalaryArchivesUseCase {
  private readonly gateway = inject(SalaryArchiveGateway);

  execute(): Observable<SalaryArchive[]> {
    return this.gateway.getAll();
  }
}
