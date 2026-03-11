import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SalaryArchive } from '../models/salary-archive.model';
import { SalaryArchiveGateway } from '../gateways/salary-archive.gateway';

@Injectable({ providedIn: 'root' })
export class CreateSalaryArchiveUseCase {
  private readonly gateway = inject(SalaryArchiveGateway);

  execute(data: FormData): Observable<SalaryArchive> {
    return this.gateway.create(data);
  }
}
