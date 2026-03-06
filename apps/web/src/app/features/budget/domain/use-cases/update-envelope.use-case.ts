import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Envelope } from '../models/envelope.model';
import { EnvelopeGateway } from '../gateways/envelope.gateway';

@Injectable({ providedIn: 'root' })
export class UpdateEnvelopeUseCase {
  private readonly gateway = inject(EnvelopeGateway);

  execute(id: string, data: Partial<Omit<Envelope, 'id'>>): Observable<Envelope> {
    return this.gateway.update(id, data);
  }
}
