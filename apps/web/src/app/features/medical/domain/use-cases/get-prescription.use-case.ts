import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Prescription } from '../models/prescription.model';
import { PrescriptionGateway } from '../gateways/prescription.gateway';

@Injectable({ providedIn: 'root' })
export class GetPrescriptionUseCase {
  private readonly gateway = inject(PrescriptionGateway);

  execute(id: string): Observable<Prescription> {
    return this.gateway.getById(id);
  }
}
