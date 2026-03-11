import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MedicalDocument } from '../models/document.model';
import { DocumentGateway } from '../gateways/document.gateway';

@Injectable({ providedIn: 'root' })
export class GetDocumentsByPatientUseCase {
  private readonly gateway = inject(DocumentGateway);

  execute(patientId: string): Observable<MedicalDocument[]> {
    return this.gateway.getByPatient(patientId);
  }
}
