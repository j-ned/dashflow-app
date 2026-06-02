import { Observable } from 'rxjs';
import { Member } from '../models/member.model';

export abstract class MemberGateway {
  abstract getAll(): Observable<Member[]>;
  abstract create(member: Omit<Member, 'id'>): Observable<Member>;
  /** Passer le membre déchiffré COMPLET : en E2EE le blob est remplacé, on préserve ainsi
   *  d'éventuels champs médicaux (la personne peut aussi être un patient). */
  abstract update(id: string, member: Member): Observable<Member>;
  abstract delete(id: string): Observable<void>;
  abstract updateColor(id: string, color: string | null): Observable<Member>;
}
