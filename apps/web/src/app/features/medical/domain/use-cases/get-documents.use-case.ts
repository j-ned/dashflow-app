import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MedicalDocument } from '../models/document.model';
import { DocumentGateway } from '../gateways/document.gateway';

@Injectable({ providedIn: 'root' })
export class GetDocumentsUseCase {
  private readonly gateway = inject(DocumentGateway);

  execute(): Observable<MedicalDocument[]> {
    return this.gateway.getAll();
  }
}
