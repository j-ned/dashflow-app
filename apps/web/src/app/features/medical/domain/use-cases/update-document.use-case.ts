import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MedicalDocument } from '../models/document.model';
import { DocumentGateway } from '../gateways/document.gateway';

@Injectable({ providedIn: 'root' })
export class UpdateDocumentUseCase {
  private readonly gateway = inject(DocumentGateway);

  execute(id: string, data: Partial<Omit<MedicalDocument, 'id' | 'fileUrl'>>): Observable<MedicalDocument> {
    return this.gateway.update(id, data);
  }
}
