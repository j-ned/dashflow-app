import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DocumentGateway } from '../gateways/document.gateway';

@Injectable({ providedIn: 'root' })
export class DeleteDocumentUseCase {
  private readonly gateway = inject(DocumentGateway);

  execute(id: string): Observable<void> {
    return this.gateway.delete(id);
  }
}
