import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Member } from '../models/member.model';
import { MemberGateway } from '../gateways/member.gateway';

@Injectable({ providedIn: 'root' })
export class GetMembersUseCase {
  private readonly gateway = inject(MemberGateway);

  execute(): Observable<Member[]> {
    return this.gateway.getAll();
  }
}
