import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { ApiRow } from '@core/services/crypto/entity-crypto';
import { decryptList, mutateEncrypted } from '@core/services/crypto/crypto-transport';
import { Member } from '../domain/models/member.model';
import { MemberGateway } from '../domain/gateways/member.gateway';

const CLEARTEXT_KEYS = ['id', 'userId', 'createdAt'] as const;

@Injectable()
export class HttpMemberGateway implements MemberGateway {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  getAll(): Observable<Member[]> {
    return decryptList(this.api.get<ApiRow[]>('/members'), this.crypto.getMasterKey());
  }

  create(member: Omit<Member, 'id'>): Observable<Member> {
    return mutateEncrypted(member as Record<string, unknown>, CLEARTEXT_KEYS, this.crypto.getMasterKey(),
      (body) => this.api.post<ApiRow>('/members', body));
  }

  update(id: string, member: Member): Observable<Member> {
    // Membre déchiffré COMPLET (au runtime il porte aussi d'éventuels champs médicaux du blob)
    // → le ré-encryptage ne perd pas les données médicales de la personne.
    const { id: _id, ...rest } = member;
    return mutateEncrypted(rest as Record<string, unknown>, CLEARTEXT_KEYS, this.crypto.getMasterKey(),
      (body) => this.api.put<ApiRow>(`/members/${id}`, body));
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/members/${id}`);
  }

  updateColor(id: string, color: string | null): Observable<Member> {
    return mutateEncrypted({ color }, CLEARTEXT_KEYS, this.crypto.getMasterKey(),
      (body) => this.api.patch<ApiRow>(`/members/${id}/color`, body));
  }
}
