import { inject, Injectable } from '@angular/core';
import { from, Observable, switchMap } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { ApiRow, encryptEntity, decryptEntities, decryptEntity } from '@core/services/crypto/entity-crypto';
import { encryptFile } from '@core/services/crypto/file-crypto';
import { Prescription } from '../domain/models/prescription.model';
import { PrescriptionGateway } from '../domain/gateways/prescription.gateway';

const CLEARTEXT_KEYS = ['id', 'userId', 'appointmentId', 'practitionerId', 'patientId', 'createdAt'] as const;

@Injectable()
export class HttpPrescriptionGateway implements PrescriptionGateway {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  getAll(): Observable<Prescription[]> {
    return this.api.get<ApiRow[]>('/prescriptions').pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows as Prescription[]]);
        return from(decryptEntities<Prescription>(rows, key));
      }),
    );
  }

  getById(id: string): Observable<Prescription> {
    return this.api.get<ApiRow>(`/prescriptions/${id}`).pipe(
      switchMap((row) => {
        const key = this.crypto.getMasterKey();
        if (!key || !row.encryptedData) return from([row as Prescription]);
        return from(decryptEntity<Prescription>(row, key));
      }),
    );
  }

  getByAppointment(appointmentId: string): Observable<Prescription[]> {
    return this.api.get<ApiRow[]>(`/prescriptions/by-appointment/${appointmentId}`).pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows as Prescription[]]);
        return from(decryptEntities<Prescription>(rows, key));
      }),
    );
  }

  create(data: Omit<Prescription, 'id' | 'documentUrl'>): Observable<Prescription> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.post<Prescription>('/prescriptions', data);

    return from(encryptEntity(data as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.post<ApiRow>('/prescriptions', encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<Prescription>(row, key)) : from([row as Prescription])),
    );
  }

  update(id: string, data: Partial<Omit<Prescription, 'id' | 'documentUrl'>>): Observable<Prescription> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.put<Prescription>(`/prescriptions/${id}`, data);

    return from(encryptEntity(data as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.put<ApiRow>(`/prescriptions/${id}`, encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<Prescription>(row, key)) : from([row as Prescription])),
    );
  }

  uploadDocument(id: string, file: File): Observable<Prescription> {
    const key = this.crypto.getMasterKey();
    if (!key) {
      const formData = new FormData();
      formData.append('file', file);
      return this.api.postForm<Prescription>(`/prescriptions/${id}/document`, formData);
    }

    return from(encryptFile(file, key)).pipe(
      switchMap((encryptedBlob) => {
        const formData = new FormData();
        formData.append('file', new File([encryptedBlob], file.name, { type: 'application/octet-stream' }));
        formData.append('originalMimeType', file.type);
        formData.append('encrypted', 'true');
        return this.api.postForm<ApiRow>(`/prescriptions/${id}/document`, formData);
      }),
      switchMap((row) => row.encryptedData ? from(decryptEntity<Prescription>(row, key)) : from([row as Prescription])),
    );
  }

  downloadDocument(id: string): Observable<Blob> {
    return this.api.getBlob(`/prescriptions/${id}/document`);
  }

  deleteDocument(id: string): Observable<void> {
    return this.api.delete(`/prescriptions/${id}/document`);
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/prescriptions/${id}`);
  }
}
