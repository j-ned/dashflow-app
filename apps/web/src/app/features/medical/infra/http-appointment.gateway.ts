import { inject, Injectable } from '@angular/core';
import { from, Observable, switchMap } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { ApiRow, encryptEntity, decryptEntities, decryptEntity } from '@core/services/crypto/entity-crypto';
import { Appointment } from '../domain/models/appointment.model';
import { AppointmentGateway } from '../domain/gateways/appointment.gateway';

const CLEARTEXT_KEYS = ['id', 'userId', 'patientId', 'practitionerId', 'createdAt'] as const;

@Injectable()
export class HttpAppointmentGateway implements AppointmentGateway {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  getAll(): Observable<Appointment[]> {
    return this.api.get<ApiRow[]>('/appointments').pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows as Appointment[]]);
        return from(decryptEntities<Appointment>(rows, key));
      }),
    );
  }

  getById(id: string): Observable<Appointment> {
    return this.api.get<ApiRow>(`/appointments/${id}`).pipe(
      switchMap((row) => {
        const key = this.crypto.getMasterKey();
        if (!key || !row.encryptedData) return from([row as Appointment]);
        return from(decryptEntity<Appointment>(row, key));
      }),
    );
  }

  create(data: Omit<Appointment, 'id'>): Observable<Appointment> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.post('/appointments', data);

    return from(encryptEntity(data as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.post<ApiRow>('/appointments', encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<Appointment>(row, key)) : from([row as Appointment])),
    );
  }

  update(id: string, data: Partial<Omit<Appointment, 'id'>>): Observable<Appointment> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.put(`/appointments/${id}`, data);

    return from(encryptEntity(data as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.put<ApiRow>(`/appointments/${id}`, encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<Appointment>(row, key)) : from([row as Appointment])),
    );
  }

  updateStatus(id: string, status: string): Observable<Appointment> {
    const key = this.crypto.getMasterKey();
    const payload = { status };
    if (!key) return this.api.patch(`/appointments/${id}/status`, payload);

    return from(encryptEntity(payload as Record<string, unknown>, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.patch<ApiRow>(`/appointments/${id}/status`, encrypted)),
      switchMap((row) => row.encryptedData ? from(decryptEntity<Appointment>(row, key)) : from([row as Appointment])),
    );
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/appointments/${id}`);
  }
}
