import { inject, Injectable } from '@angular/core';
import { from, map, Observable, switchMap } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { ApiRow } from '@core/services/crypto/entity-crypto';
import {
  decryptBlob,
  decryptList,
  decryptOne,
  mutateEncrypted,
} from '@core/services/crypto/crypto-transport';
import { encryptFile } from '@core/services/crypto/file-crypto';
import { RecurringEntry } from '../domain/models/recurring-entry.model';
import { RecurringEntryGateway } from '../domain/gateways/recurring-entry.gateway';
import { withAutoPostDefaults } from './recurring-entry.adapter';

const CLEARTEXT_KEYS = [
  'id',
  'userId',
  'memberId',
  'accountId',
  'toAccountId',
  'createdAt',
] as const;

@Injectable()
export class HttpRecurringEntryGateway implements RecurringEntryGateway {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  getAll(): Observable<RecurringEntry[]> {
    return decryptList<RecurringEntry>(
      this.api.get<ApiRow[]>('/recurring-entries'),
      this.crypto.getMasterKey(),
    ).pipe(map((list) => list.map(withAutoPostDefaults)));
  }

  create(data: Omit<RecurringEntry, 'id'>): Observable<RecurringEntry> {
    return mutateEncrypted(
      data as Record<string, unknown>,
      CLEARTEXT_KEYS,
      this.crypto.getMasterKey(),
      (body) => this.api.post<ApiRow>('/recurring-entries', body),
    );
  }

  update(id: string, data: Partial<Omit<RecurringEntry, 'id'>>): Observable<RecurringEntry> {
    return mutateEncrypted(
      data as Record<string, unknown>,
      CLEARTEXT_KEYS,
      this.crypto.getMasterKey(),
      (body) => this.api.put<ApiRow>(`/recurring-entries/${id}`, body),
    );
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/recurring-entries/${id}`);
  }

  uploadPayslip(id: string, file: File): Observable<RecurringEntry> {
    const key = this.crypto.getMasterKey();
    if (!key) {
      const fd = new FormData();
      fd.append('file', file);
      return this.api.postForm(`/recurring-entries/${id}/payslip`, fd);
    }

    return from(encryptFile(file, key)).pipe(
      switchMap((encryptedBlob) => {
        const fd = new FormData();
        fd.append(
          'file',
          new File([encryptedBlob], file.name, { type: 'application/octet-stream' }),
        );
        fd.append('originalMimeType', file.type);
        fd.append('encrypted', 'true');
        return decryptOne<RecurringEntry>(
          this.api.postForm<ApiRow>(`/recurring-entries/${id}/payslip`, fd),
          key,
        );
      }),
    );
  }

  downloadPayslip(id: string): Observable<Blob> {
    return decryptBlob(
      this.api.getBlob(`/recurring-entries/${id}/payslip`),
      this.crypto.getMasterKey(),
      'application/pdf',
    );
  }

  deletePayslip(id: string): Observable<void> {
    return this.api.delete(`/recurring-entries/${id}/payslip`);
  }
}
