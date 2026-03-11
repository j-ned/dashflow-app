import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SalaryArchiveGateway } from '../gateways/salary-archive.gateway';

@Injectable({ providedIn: 'root' })
export class DeleteSalaryArchiveUseCase {
  private readonly gateway = inject(SalaryArchiveGateway);

  execute(id: string): Observable<void> {
    return this.gateway.delete(id);
  }
}
