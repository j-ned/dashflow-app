import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PractitionerGateway } from '../gateways/practitioner.gateway';

@Injectable({ providedIn: 'root' })
export class DeletePractitionerUseCase {
  private readonly gateway = inject(PractitionerGateway);

  execute(id: string): Observable<void> {
    return this.gateway.delete(id);
  }
}
