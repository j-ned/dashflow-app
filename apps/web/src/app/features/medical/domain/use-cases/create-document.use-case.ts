import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MedicalDocument } from '../models/document.model';
import { DocumentGateway } from '../gateways/document.gateway';

@Injectable({ providedIn: 'root' })
export class CreateDocumentUseCase {
  private readonly gateway = inject(DocumentGateway);

  execute(data: Omit<MedicalDocument, 'id' | 'fileUrl'>): Observable<MedicalDocument> {
    return this.gateway.create(data);
  }
}
