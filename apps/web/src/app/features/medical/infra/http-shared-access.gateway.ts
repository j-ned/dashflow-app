import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { SharedAccess } from '../domain/models/shared-access.model';
import { SharedAccessGateway } from '../domain/gateways/shared-access.gateway';

@Injectable()
export class HttpSharedAccessGateway implements SharedAccessGateway {
  private readonly api = inject(ApiClient);

  getAll(): Observable<SharedAccess[]> {
    return this.api.get('/shared-access');
  }

  create(data: Omit<SharedAccess, 'id'>): Observable<SharedAccess> {
    return this.api.post('/shared-access', data);
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/shared-access/${id}`);
  }
}
