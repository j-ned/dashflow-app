import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SharedAccessGateway } from '../gateways/shared-access.gateway';

@Injectable({ providedIn: 'root' })
export class DeleteSharedAccessUseCase {
  private readonly gateway = inject(SharedAccessGateway);

  execute(id: string): Observable<void> {
    return this.gateway.delete(id);
  }
}
