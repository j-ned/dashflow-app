import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { EnvelopeTransaction } from '../models/envelope-transaction.model';
import { EnvelopeGateway } from '../gateways/envelope.gateway';

@Injectable({ providedIn: 'root' })
export class GetAllEnvelopeTransactionsUseCase {
  private readonly gateway = inject(EnvelopeGateway);

  execute(): Observable<EnvelopeTransaction[]> {
    return this.gateway.getAllTransactions();
  }
}
