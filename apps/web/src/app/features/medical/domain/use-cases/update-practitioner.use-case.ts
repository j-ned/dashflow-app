import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Practitioner } from '../models/practitioner.model';
import { PractitionerGateway } from '../gateways/practitioner.gateway';

@Injectable({ providedIn: 'root' })
export class UpdatePractitionerUseCase {
  private readonly gateway = inject(PractitionerGateway);

  execute(id: string, data: Partial<Omit<Practitioner, 'id'>>): Observable<Practitioner> {
    return this.gateway.update(id, data);
  }
}
