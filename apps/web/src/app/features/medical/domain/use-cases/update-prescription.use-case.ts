import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Prescription } from '../models/prescription.model';
import { PrescriptionGateway } from '../gateways/prescription.gateway';

@Injectable({ providedIn: 'root' })
export class UpdatePrescriptionUseCase {
  private readonly gateway = inject(PrescriptionGateway);

  execute(id: string, data: Partial<Omit<Prescription, 'id' | 'documentUrl'>>): Observable<Prescription> {
    return this.gateway.update(id, data);
  }
}
