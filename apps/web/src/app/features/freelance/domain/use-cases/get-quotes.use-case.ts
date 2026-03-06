import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Quote } from '../models/quote.model';
import { QuoteGateway } from '../gateways/quote.gateway';

@Injectable({ providedIn: 'root' })
export class GetQuotesUseCase {
  private readonly gateway = inject(QuoteGateway);

  execute(): Observable<Quote[]> {
    return this.gateway.getAll();
  }
}
