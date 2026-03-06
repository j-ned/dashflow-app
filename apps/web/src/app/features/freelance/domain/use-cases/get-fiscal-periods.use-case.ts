import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { FiscalPeriod } from '../models/fiscal-period.model';
import { FiscalGateway } from '../gateways/fiscal.gateway';

@Injectable({ providedIn: 'root' })
export class GetFiscalPeriodsUseCase {
  private readonly gateway = inject(FiscalGateway);

  execute(): Observable<FiscalPeriod[]> {
    return this.gateway.getAll();
  }
}
