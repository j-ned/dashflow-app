import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SharedAccess } from '../models/shared-access.model';
import { SharedAccessGateway } from '../gateways/shared-access.gateway';

@Injectable({ providedIn: 'root' })
export class CreateSharedAccessUseCase {
  private readonly gateway = inject(SharedAccessGateway);

  execute(data: { invitedEmail: string }): Observable<SharedAccess> {
    return this.gateway.create(data);
  }
}
