import { inject, Injectable } from '@angular/core';
import { from, map, Observable, switchMap } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { ApiRow, decryptEntities, decryptEntity } from '@core/services/crypto/entity-crypto';
import { decryptOne, mutateEncrypted } from '@core/services/crypto/crypto-transport';
import { encryptFile } from '@core/services/crypto/file-crypto';
import { validateList, validateOne } from '@core/services/crypto/validate-decrypted';
import { Prescription } from '../domain/models/prescription.model';
import { PrescriptionGateway } from '../domain/gateways/prescription.gateway';
import { PrescriptionSchema } from './schemas/prescription.schema';

const CLEARTEXT_KEYS = [
  'id',
  'userId',
  'appointmentId',
  'practitionerId',
  'patientId',
  'createdAt',
] as const;

@Injectable()
export class HttpPrescriptionGateway implements PrescriptionGateway {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  getAll(): Observable<Prescription[]> {
    return this.api.get<ApiRow[]>('/prescriptions').pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows as Prescription[]]);
        return from(decryptEntities<Prescription>(rows, key)).pipe(
          map((list) => validateList(PrescriptionSchema, list, { entity: 'Prescription' })),
        );
      }),
    );
  }

  getById(id: string): Observable<Prescription> {
    return this.api.get<ApiRow>(`/prescriptions/${id}`).pipe(
      switchMap((row) => {
        const key = this.crypto.getMasterKey();
        if (!key || !row.encryptedData) return from([row as Prescription]);
        return from(decryptEntity<Prescription>(row, key)).pipe(
          map((p) => validateOne(PrescriptionSchema, p, { entity: 'Prescription' })),
        );
      }),
    );
  }

  getByAppointment(appointmentId: string): Observable<Prescription[]> {
    return this.api.get<ApiRow[]>(`/prescriptions/by-appointment/${appointmentId}`).pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows as Prescription[]]);
        return from(decryptEntities<Prescription>(rows, key)).pipe(
          map((list) => validateList(PrescriptionSchema, list, { entity: 'Prescription' })),
        );
      }),
    );
  }

  create(data: Omit<Prescription, 'id' | 'documentUrl'>): Observable<Prescription> {
    return mutateEncrypted(
      data as Record<string, unknown>,
      CLEARTEXT_KEYS,
      this.crypto.getMasterKey(),
      (body) => this.api.post<ApiRow>('/prescriptions', body),
    );
  }

  update(
    id: string,
    data: Partial<Omit<Prescription, 'id' | 'documentUrl'>>,
  ): Observable<Prescription> {
    return mutateEncrypted(
      data as Record<string, unknown>,
      CLEARTEXT_KEYS,
      this.crypto.getMasterKey(),
      (body) => this.api.put<ApiRow>(`/prescriptions/${id}`, body),
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
        formData.append(
          'file',
          new File([encryptedBlob], file.name, { type: 'application/octet-stream' }),
        );
        formData.append('originalMimeType', file.type);
        formData.append('encrypted', 'true');
        return decryptOne<Prescription>(
          this.api.postForm<ApiRow>(`/prescriptions/${id}/document`, formData),
          key,
        );
      }),
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
