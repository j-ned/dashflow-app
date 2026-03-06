import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Invoice } from '../models/invoice.model';
import { InvoiceGateway } from '../gateways/invoice.gateway';

@Injectable({ providedIn: 'root' })
export class GetInvoicesUseCase {
  private readonly gateway = inject(InvoiceGateway);

  execute(): Observable<Invoice[]> {
    return this.gateway.getAll();
  }
}
