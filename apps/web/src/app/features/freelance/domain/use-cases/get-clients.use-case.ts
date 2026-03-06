import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Client } from '../models/client.model';
import { ClientGateway } from '../gateways/client.gateway';

@Injectable({ providedIn: 'root' })
export class GetClientsUseCase {
  private readonly gateway = inject(ClientGateway);

  execute(): Observable<Client[]> {
    return this.gateway.getAll();
  }
}
