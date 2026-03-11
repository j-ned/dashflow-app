import { Observable } from 'rxjs';
import { Member } from '../models/member.model';

export abstract class MemberGateway {
  abstract getAll(): Observable<Member[]>;
  abstract updateColor(id: string, color: string | null): Observable<Member>;
}
