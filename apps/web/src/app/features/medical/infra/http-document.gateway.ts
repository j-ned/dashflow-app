import { inject, Injectable } from '@angular/core';
import { from, Observable, switchMap, map } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { encryptEntity, decryptEntities, decryptEntity } from '@core/services/crypto/entity-crypto';
import { encryptFile } from '@core/services/crypto/file-crypto';
import { MedicalDocument } from '../domain/models/document.model';
import { DocumentGateway } from '../domain/gateways/document.gateway';

const CLEARTEXT_KEYS = ['id', 'userId', 'patientId', 'practitionerId', 'createdAt'] as const;

@Injectable()
export class HttpDocumentGateway implements DocumentGateway {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  private resolveFileUrl(d: MedicalDocument): MedicalDocument {
    if (!d.fileUrl || d.fileUrl.startsWith('http')) return d;
    const token = this.api.getToken();
    const sep = d.fileUrl.includes('?') ? '&' : '?';
    return { ...d, fileUrl: `${d.fileUrl}${token ? `${sep}token=${token}` : ''}` };
  }

  getAll(): Observable<MedicalDocument[]> {
    return this.api.get<any[]>('/documents').pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows as MedicalDocument[]]);
        return from(decryptEntities<MedicalDocument>(rows, key));
      }),
      map(list => list.map(d => this.resolveFileUrl(d))),
    );
  }

  getById(id: string): Observable<MedicalDocument> {
    return this.api.get<any>(`/documents/${id}`).pipe(
      switchMap((row) => {
        const key = this.crypto.getMasterKey();
        if (!key || !row.encryptedData) return from([row as MedicalDocument]);
        return from(decryptEntity<MedicalDocument>(row, key));
      }),
      map(d => this.resolveFileUrl(d)),
    );
  }

  getByPatient(patientId: string): Observable<MedicalDocument[]> {
    return this.api.get<any[]>(`/documents/by-patient/${patientId}`).pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows as MedicalDocument[]]);
        return from(decryptEntities<MedicalDocument>(rows, key));
      }),
      map(list => list.map(d => this.resolveFileUrl(d))),
    );
  }

  create(data: Omit<MedicalDocument, 'id' | 'fileUrl'>): Observable<MedicalDocument> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.post<MedicalDocument>('/documents', data).pipe(map(d => this.resolveFileUrl(d)));

    return from(encryptEntity(data as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.post<any>('/documents', encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<MedicalDocument>(row, key)) : from([row as MedicalDocument])),
      map(d => this.resolveFileUrl(d)),
    );
  }

  update(id: string, data: Partial<Omit<MedicalDocument, 'id' | 'fileUrl'>>): Observable<MedicalDocument> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.put<MedicalDocument>(`/documents/${id}`, data).pipe(map(d => this.resolveFileUrl(d)));

    return from(encryptEntity(data as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.put<any>(`/documents/${id}`, encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<MedicalDocument>(row, key)) : from([row as MedicalDocument])),
      map(d => this.resolveFileUrl(d)),
    );
  }

  uploadFile(id: string, file: File): Observable<MedicalDocument> {
    const key = this.crypto.getMasterKey();
    if (!key) {
      const formData = new FormData();
      formData.append('file', file);
      return this.api.postForm<MedicalDocument>(`/documents/${id}/file`, formData).pipe(map(d => this.resolveFileUrl(d)));
    }

    return from(encryptFile(file, key)).pipe(
      switchMap((encryptedBlob) => {
        const formData = new FormData();
        formData.append('file', new File([encryptedBlob], file.name, { type: 'application/octet-stream' }));
        formData.append('originalMimeType', file.type);
        formData.append('encrypted', 'true');
        return this.api.postForm<any>(`/documents/${id}/file`, formData);
      }),
      switchMap((row) => row.encryptedData ? from(decryptEntity<MedicalDocument>(row, key)) : from([row as MedicalDocument])),
      map(d => this.resolveFileUrl(d)),
    );
  }

  deleteFile(id: string): Observable<void> {
    return this.api.delete(`/documents/${id}/file`);
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/documents/${id}`);
  }
}
