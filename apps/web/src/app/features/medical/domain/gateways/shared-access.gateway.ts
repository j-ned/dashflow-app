import { Observable } from 'rxjs';
import { SharedAccess } from '../models/shared-access.model';

export abstract class SharedAccessGateway {
  abstract getAll(): Observable<SharedAccess[]>;
  abstract create(data: { invitedEmail: string }): Observable<SharedAccess>;
  abstract delete(id: string): Observable<void>;
}
