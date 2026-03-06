import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Envelope } from '../models/envelope.model';
import { EnvelopeGateway } from '../gateways/envelope.gateway';

@Injectable({ providedIn: 'root' })
export class CreateEnvelopeUseCase {
  private readonly gateway = inject(EnvelopeGateway);

  execute(data: Omit<Envelope, 'id'>): Observable<Envelope> {
    return this.gateway.create(data);
  }
}
