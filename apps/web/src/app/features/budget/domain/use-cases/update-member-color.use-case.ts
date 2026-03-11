import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MemberGateway } from '../gateways/member.gateway';
import { Member } from '../models/member.model';

@Injectable({ providedIn: 'root' })
export class UpdateMemberColorUseCase {
  private readonly gateway = inject(MemberGateway);

  execute(id: string, color: string | null): Observable<Member> {
    return this.gateway.updateColor(id, color);
  }
}
