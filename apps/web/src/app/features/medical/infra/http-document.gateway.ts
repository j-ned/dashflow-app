import { inject, Injectable } from '@angular/core';
import { from, Observable, switchMap } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { ApiRow, encryptEntity, decryptEntities, decryptEntity } from '@core/services/crypto/entity-crypto';
import { encryptFile } from '@core/services/crypto/file-crypto';
import { MedicalDocument } from '../domain/models/document.model';
import { DocumentGateway } from '../domain/gateways/document.gateway';

const CLEARTEXT_KEYS = ['id', 'userId', 'patientId', 'practitionerId', 'createdAt'] as const;

@Injectable()
export class HttpDocumentGateway implements DocumentGateway {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  getAll(): Observable<MedicalDocument[]> {
    return this.api.get<ApiRow[]>('/documents').pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows as MedicalDocument[]]);
        return from(decryptEntities<MedicalDocument>(rows, key));
      }),
    );
  }

  getById(id: string): Observable<MedicalDocument> {
    return this.api.get<ApiRow>(`/documents/${id}`).pipe(
      switchMap((row) => {
        const key = this.crypto.getMasterKey();
        if (!key || !row.encryptedData) return from([row as MedicalDocument]);
        return from(decryptEntity<MedicalDocument>(row, key));
      }),
    );
  }

  getByPatient(patientId: string): Observable<MedicalDocument[]> {
    return this.api.get<ApiRow[]>(`/documents/by-patient/${patientId}`).pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows as MedicalDocument[]]);
        return from(decryptEntities<MedicalDocument>(rows, key));
      }),
    );
  }

  create(data: Omit<MedicalDocument, 'id' | 'fileUrl'>): Observable<MedicalDocument> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.post<MedicalDocument>('/documents', data);

    return from(encryptEntity(data as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.post<ApiRow>('/documents', encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<MedicalDocument>(row, key)) : from([row as MedicalDocument])),
    );
  }

  update(id: string, data: Partial<Omit<MedicalDocument, 'id' | 'fileUrl'>>): Observable<MedicalDocument> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.put<MedicalDocument>(`/documents/${id}`, data);

    return from(encryptEntity(data as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.put<ApiRow>(`/documents/${id}`, encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<MedicalDocument>(row, key)) : from([row as MedicalDocument])),
    );
  }

  uploadFile(id: string, file: File): Observable<MedicalDocument> {
    const key = this.crypto.getMasterKey();
    if (!key) {
      const formData = new FormData();
      formData.append('file', file);
      return this.api.postForm<MedicalDocument>(`/documents/${id}/file`, formData);
    }

    return from(encryptFile(file, key)).pipe(
      switchMap((encryptedBlob) => {
        const formData = new FormData();
        formData.append('file', new File([encryptedBlob], file.name, { type: 'application/octet-stream' }));
        formData.append('originalMimeType', file.type);
        formData.append('encrypted', 'true');
        return this.api.postForm<ApiRow>(`/documents/${id}/file`, formData);
      }),
      switchMap((row) => row.encryptedData ? from(decryptEntity<MedicalDocument>(row, key)) : from([row as MedicalDocument])),
    );
  }

  downloadFile(id: string): Observable<Blob> {
    return this.api.getBlob(`/documents/${id}/file`);
  }

  deleteFile(id: string): Observable<void> {
    return this.api.delete(`/documents/${id}/file`);
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/documents/${id}`);
  }
}
