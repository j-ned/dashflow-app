import { inject, Injectable } from '@angular/core';
import { from, map, Observable, switchMap } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { ApiRow, decryptEntities, decryptEntity } from '@core/services/crypto/entity-crypto';
import { decryptOne, mutateEncrypted } from '@core/services/crypto/crypto-transport';
import { encryptFile } from '@core/services/crypto/file-crypto';
import { validateList, validateOne } from '@core/services/crypto/validate-decrypted';
import { MedicalDocument } from '../domain/models/document.model';
import { DocumentGateway } from '../domain/gateways/document.gateway';
import { MedicalDocumentSchema } from './schemas/document.schema';

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
        return from(decryptEntities<MedicalDocument>(rows, key)).pipe(
          map((list) => validateList(MedicalDocumentSchema, list, { entity: 'MedicalDocument' })),
        );
      }),
    );
  }

  getById(id: string): Observable<MedicalDocument> {
    return this.api.get<ApiRow>(`/documents/${id}`).pipe(
      switchMap((row) => {
        const key = this.crypto.getMasterKey();
        if (!key || !row.encryptedData) return from([row as MedicalDocument]);
        return from(decryptEntity<MedicalDocument>(row, key)).pipe(
          map((d) => validateOne(MedicalDocumentSchema, d, { entity: 'MedicalDocument' })),
        );
      }),
    );
  }

  getByPatient(patientId: string): Observable<MedicalDocument[]> {
    return this.api.get<ApiRow[]>(`/documents/by-patient/${patientId}`).pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows as MedicalDocument[]]);
        return from(decryptEntities<MedicalDocument>(rows, key)).pipe(
          map((list) => validateList(MedicalDocumentSchema, list, { entity: 'MedicalDocument' })),
        );
      }),
    );
  }

  create(data: Omit<MedicalDocument, 'id' | 'fileUrl'>): Observable<MedicalDocument> {
    return mutateEncrypted(
      data as Record<string, unknown>,
      CLEARTEXT_KEYS,
      this.crypto.getMasterKey(),
      (body) => this.api.post<ApiRow>('/documents', body),
    );
  }

  update(
    id: string,
    data: Partial<Omit<MedicalDocument, 'id' | 'fileUrl'>>,
  ): Observable<MedicalDocument> {
    return mutateEncrypted(
      data as Record<string, unknown>,
      CLEARTEXT_KEYS,
      this.crypto.getMasterKey(),
      (body) => this.api.put<ApiRow>(`/documents/${id}`, body),
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
        formData.append(
          'file',
          new File([encryptedBlob], file.name, { type: 'application/octet-stream' }),
        );
        formData.append('originalMimeType', file.type);
        formData.append('encrypted', 'true');
        return decryptOne<MedicalDocument>(
          this.api.postForm<ApiRow>(`/documents/${id}/file`, formData),
          key,
        );
      }),
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
