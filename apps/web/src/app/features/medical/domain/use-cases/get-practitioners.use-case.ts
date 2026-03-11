import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Practitioner } from '../models/practitioner.model';
import { PractitionerGateway } from '../gateways/practitioner.gateway';

@Injectable({ providedIn: 'root' })
export class GetPractitionersUseCase {
  private readonly gateway = inject(PractitionerGateway);

  execute(): Observable<Practitioner[]> {
    return this.gateway.getAll();
  }
}
