import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PrescriptionGateway } from '../gateways/prescription.gateway';

@Injectable({ providedIn: 'root' })
export class DeletePrescriptionDocumentUseCase {
  private readonly gateway = inject(PrescriptionGateway);

  execute(id: string): Observable<void> {
    return this.gateway.deleteDocument(id);
  }
}
