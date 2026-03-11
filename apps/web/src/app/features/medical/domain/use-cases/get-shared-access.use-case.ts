import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SharedAccess } from '../models/shared-access.model';
import { SharedAccessGateway } from '../gateways/shared-access.gateway';

@Injectable({ providedIn: 'root' })
export class GetSharedAccessUseCase {
  private readonly gateway = inject(SharedAccessGateway);

  execute(): Observable<SharedAccess[]> {
    return this.gateway.getAll();
  }
}
