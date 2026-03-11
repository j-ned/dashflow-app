import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Prescription } from '../models/prescription.model';
import { PrescriptionGateway } from '../gateways/prescription.gateway';

@Injectable({ providedIn: 'root' })
export class UploadPrescriptionDocumentUseCase {
  private readonly gateway = inject(PrescriptionGateway);

  execute(id: string, file: File): Observable<Prescription> {
    return this.gateway.uploadDocument(id, file);
  }
}
