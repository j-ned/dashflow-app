import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Envelope } from '../models/envelope.model';
import { EnvelopeGateway } from '../gateways/envelope.gateway';

@Injectable({ providedIn: 'root' })
export class CreditEnvelopeUseCase {
  private readonly gateway = inject(EnvelopeGateway);

  execute(id: string, amount: number): Observable<Envelope> {
    return this.gateway.updateBalance(id, amount);
  }
}
