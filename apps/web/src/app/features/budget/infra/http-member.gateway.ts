import { inject, Injectable } from '@angular/core';
import { from, Observable, switchMap } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { encryptEntity, decryptEntities, decryptEntity } from '@core/services/crypto/entity-crypto';
import { Member } from '../domain/models/member.model';
import { MemberGateway } from '../domain/gateways/member.gateway';

const CLEARTEXT_KEYS = ['id', 'userId', 'createdAt'] as const;

@Injectable()
export class HttpMemberGateway extends MemberGateway {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  getAll(): Observable<Member[]> {
    return this.api.get<any[]>('/members').pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows as Member[]]);
        return from(decryptEntities<Member>(rows, key));
      }),
    );
  }

  updateColor(id: string, color: string | null): Observable<Member> {
    const key = this.crypto.getMasterKey();
    const payload = { color };
    if (!key) return this.api.patch(`/members/${id}/color`, payload);

    return from(encryptEntity(payload as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.patch<any>(`/members/${id}/color`, encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<Member>(row, key)) : from([row as Member])),
    );
  }
}
