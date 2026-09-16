import { Observable } from 'rxjs';
import { Member } from '../models/member.model';

export abstract class MemberGateway {
  abstract getAll(): Observable<Member[]>;
  abstract create(member: Omit<Member, 'id'>): Observable<Member>;
  /** Passer le membre déchiffré COMPLET : en E2EE le blob est remplacé, on préserve ainsi
   *  d'éventuels champs médicaux (la personne peut aussi être un patient). */
  abstract update(id: string, member: Member): Observable<Member>;
  /** Sans `force`, le serveur répond 409 `MEMBER_HAS_MEDICAL_DATA` (+ `details` compteurs) si la
   *  personne a un dossier médical : la suppression l'effacerait aussi. `force` confirme. */
  abstract delete(id: string, options?: { force?: boolean }): Observable<void>;
  abstract updateColor(id: string, color: string | null): Observable<Member>;
}
