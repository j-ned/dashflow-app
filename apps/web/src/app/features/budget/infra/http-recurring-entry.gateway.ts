import { inject, Injectable } from '@angular/core';
import { from, Observable, switchMap } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { encryptEntity, decryptEntities, decryptEntity } from '@core/services/crypto/entity-crypto';
import { encryptFile, decryptFile } from '@core/services/crypto/file-crypto';
import { RecurringEntry } from '../domain/models/recurring-entry.model';
import { RecurringEntryGateway } from '../domain/gateways/recurring-entry.gateway';

const CLEARTEXT_KEYS = ['id', 'userId', 'memberId', 'accountId', 'createdAt'] as const;

@Injectable()
export class HttpRecurringEntryGateway extends RecurringEntryGateway {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  getAll(): Observable<RecurringEntry[]> {
    return this.api.get<any[]>('/recurring-entries').pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows as RecurringEntry[]]);
        return from(decryptEntities<RecurringEntry>(rows, key));
      }),
    );
  }

  create(data: Omit<RecurringEntry, 'id'>): Observable<RecurringEntry> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.post('/recurring-entries', data);

    return from(encryptEntity(data as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.post<any>('/recurring-entries', encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<RecurringEntry>(row, key)) : from([row as RecurringEntry])),
    );
  }

  update(id: string, data: Partial<Omit<RecurringEntry, 'id'>>): Observable<RecurringEntry> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.put(`/recurring-entries/${id}`, data);

    return from(encryptEntity(data as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.put<any>(`/recurring-entries/${id}`, encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<RecurringEntry>(row, key)) : from([row as RecurringEntry])),
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
        fd.append('file', new File([encryptedBlob], file.name, { type: 'application/octet-stream' }));
        fd.append('originalMimeType', file.type);
        fd.append('encrypted', 'true');
        return this.api.postForm<any>(`/recurring-entries/${id}/payslip`, fd);
      }),
      switchMap((row) => row.encryptedData ? from(decryptEntity<RecurringEntry>(row, key)) : from([row as RecurringEntry])),
    );
  }

  downloadPayslip(id: string): Observable<Blob> {
    return this.api.getBlob(`/recurring-entries/${id}/payslip`).pipe(
      switchMap((blob) => {
        const key = this.crypto.getMasterKey();
        if (!key) return from([blob]);
        // If the blob is application/octet-stream, it's likely encrypted
        if (blob.type === 'application/octet-stream') {
          return from(decryptFile(blob, key, 'application/pdf'));
        }
        return from([blob]);
      }),
    );
  }

  deletePayslip(id: string): Observable<void> {
    return this.api.delete(`/recurring-entries/${id}/payslip`);
  }
}
