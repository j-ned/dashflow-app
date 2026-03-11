import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MedicalDocument } from '../models/document.model';
import { DocumentGateway } from '../gateways/document.gateway';

@Injectable({ providedIn: 'root' })
export class UploadDocumentFileUseCase {
  private readonly gateway = inject(DocumentGateway);

  execute(id: string, file: File): Observable<MedicalDocument> {
    return this.gateway.uploadFile(id, file);
  }
}
