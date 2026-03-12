import { inject, Injectable } from '@angular/core';
import { from, Observable, switchMap, map } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { encryptEntity, decryptEntities, decryptEntity } from '@core/services/crypto/entity-crypto';
import { encryptFile } from '@core/services/crypto/file-crypto';
import { Prescription } from '../domain/models/prescription.model';
import { PrescriptionGateway } from '../domain/gateways/prescription.gateway';

const CLEARTEXT_KEYS = ['id', 'userId', 'appointmentId', 'practitionerId', 'patientId', 'createdAt'] as const;

@Injectable()
export class HttpPrescriptionGateway implements PrescriptionGateway {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  private resolveDocUrl(p: Prescription): Prescription {
    if (!p.documentUrl || p.documentUrl.startsWith('http')) return p;
    const token = this.api.getToken();
    const sep = p.documentUrl.includes('?') ? '&' : '?';
    return { ...p, documentUrl: `${p.documentUrl}${token ? `${sep}token=${token}` : ''}` };
  }

  getAll(): Observable<Prescription[]> {
    return this.api.get<any[]>('/prescriptions').pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows as Prescription[]]);
        return from(decryptEntities<Prescription>(rows, key));
      }),
      map(list => list.map(p => this.resolveDocUrl(p))),
    );
  }

  getById(id: string): Observable<Prescription> {
    return this.api.get<any>(`/prescriptions/${id}`).pipe(
      switchMap((row) => {
        const key = this.crypto.getMasterKey();
        if (!key || !row.encryptedData) return from([row as Prescription]);
        return from(decryptEntity<Prescription>(row, key));
      }),
      map(p => this.resolveDocUrl(p)),
    );
  }

  getByAppointment(appointmentId: string): Observable<Prescription[]> {
    return this.api.get<any[]>(`/prescriptions/by-appointment/${appointmentId}`).pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows as Prescription[]]);
        return from(decryptEntities<Prescription>(rows, key));
      }),
      map(list => list.map(p => this.resolveDocUrl(p))),
    );
  }

  create(data: Omit<Prescription, 'id' | 'documentUrl'>): Observable<Prescription> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.post<Prescription>('/prescriptions', data).pipe(map(p => this.resolveDocUrl(p)));

    return from(encryptEntity(data as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.post<any>('/prescriptions', encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<Prescription>(row, key)) : from([row as Prescription])),
      map(p => this.resolveDocUrl(p)),
    );
  }

  update(id: string, data: Partial<Omit<Prescription, 'id' | 'documentUrl'>>): Observable<Prescription> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.put<Prescription>(`/prescriptions/${id}`, data).pipe(map(p => this.resolveDocUrl(p)));

    return from(encryptEntity(data as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.put<any>(`/prescriptions/${id}`, encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<Prescription>(row, key)) : from([row as Prescription])),
      map(p => this.resolveDocUrl(p)),
    );
  }

  uploadDocument(id: string, file: File): Observable<Prescription> {
    const key = this.crypto.getMasterKey();
    if (!key) {
      const formData = new FormData();
      formData.append('file', file);
      return this.api.postForm<Prescription>(`/prescriptions/${id}/document`, formData).pipe(map(p => this.resolveDocUrl(p)));
    }

    return from(encryptFile(file, key)).pipe(
      switchMap((encryptedBlob) => {
        const formData = new FormData();
        formData.append('file', new File([encryptedBlob], file.name, { type: 'application/octet-stream' }));
        formData.append('originalMimeType', file.type);
        formData.append('encrypted', 'true');
        return this.api.postForm<any>(`/prescriptions/${id}/document`, formData);
      }),
      switchMap((row) => row.encryptedData ? from(decryptEntity<Prescription>(row, key)) : from([row as Prescription])),
      map(p => this.resolveDocUrl(p)),
    );
  }

  deleteDocument(id: string): Observable<void> {
    return this.api.delete(`/prescriptions/${id}/document`);
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/prescriptions/${id}`);
  }
}
