import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { EnvelopeGateway } from '../gateways/envelope.gateway';

@Injectable({ providedIn: 'root' })
export class DeleteEnvelopeUseCase {
  private readonly gateway = inject(EnvelopeGateway);

  execute(id: string): Observable<void> {
    return this.gateway.delete(id);
  }
}
