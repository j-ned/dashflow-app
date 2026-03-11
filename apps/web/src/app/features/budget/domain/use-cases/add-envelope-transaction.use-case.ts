import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { EnvelopeTransaction } from '../models/envelope-transaction.model';
import { EnvelopeGateway } from '../gateways/envelope.gateway';

@Injectable({ providedIn: 'root' })
export class AddEnvelopeTransactionUseCase {
  private readonly gateway = inject(EnvelopeGateway);

  execute(envelopeId: string, data: { amount: number; date: string }): Observable<EnvelopeTransaction> {
    return this.gateway.addTransaction(envelopeId, data);
  }
}
