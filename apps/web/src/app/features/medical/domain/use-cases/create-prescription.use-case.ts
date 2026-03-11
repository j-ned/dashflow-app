import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Prescription } from '../models/prescription.model';
import { PrescriptionGateway } from '../gateways/prescription.gateway';

@Injectable({ providedIn: 'root' })
export class CreatePrescriptionUseCase {
  private readonly gateway = inject(PrescriptionGateway);

  execute(data: Omit<Prescription, 'id' | 'documentUrl'>): Observable<Prescription> {
    return this.gateway.create(data);
  }
}
