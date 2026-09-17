import { inject, Injectable } from '@angular/core';
import { from, map, Observable, switchMap } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { ApiRow, decryptEntities, decryptEntity } from '@core/services/crypto/entity-crypto';
import { mutateEncrypted } from '@core/services/crypto/crypto-transport';
import { validateList, validateOne } from '@core/services/crypto/validate-decrypted';
import { Appointment, AppointmentStatus } from '../domain/models/appointment.model';
import { AppointmentGateway } from '../domain/gateways/appointment.gateway';
import { AppointmentSchema } from './schemas/appointment.schema';

const CLEARTEXT_KEYS = ['id', 'userId', 'patientId', 'practitionerId', 'createdAt'] as const;

@Injectable()
export class HttpAppointmentGateway implements AppointmentGateway {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  getAll(): Observable<Appointment[]> {
    return this.api.getList<ApiRow>('/appointments').pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows as Appointment[]]);
        return from(decryptEntities<Appointment>(rows, key)).pipe(
          map((list) => validateList(AppointmentSchema, list, { entity: 'Appointment' })),
        );
      }),
    );
  }

  getById(id: string): Observable<Appointment> {
    return this.api.get<ApiRow>(`/appointments/${id}`).pipe(
      switchMap((row) => {
        const key = this.crypto.getMasterKey();
        if (!key || !row.encryptedData) return from([row as Appointment]);
        return from(decryptEntity<Appointment>(row, key)).pipe(
          map((a) => validateOne(AppointmentSchema, a, { entity: 'Appointment' })),
        );
      }),
    );
  }

  create(data: Omit<Appointment, 'id'>): Observable<Appointment> {
    return mutateEncrypted(
      data as Record<string, unknown>,
      CLEARTEXT_KEYS,
      this.crypto.getMasterKey(),
      (body) => this.api.post<ApiRow>('/appointments', body),
    );
  }

  update(id: string, data: Partial<Omit<Appointment, 'id'>>): Observable<Appointment> {
    return mutateEncrypted(
      data as Record<string, unknown>,
      CLEARTEXT_KEYS,
      this.crypto.getMasterKey(),
      (body) => this.api.put<ApiRow>(`/appointments/${id}`, body),
      { rowId: id },
    );
  }

  updateStatus(appointment: Appointment, status: AppointmentStatus): Observable<Appointment> {
    const key = this.crypto.getMasterKey();
    if (key) {
      // E2EE : `status` vit dans le blob, le PATCH serveur l'attend en clair et répondait 400.
      // On rechiffre le rendez-vous complet avec son nouveau statut.
      const { id, ...rest } = appointment;
      return this.update(id, { ...rest, status });
    }
    return this.api
      .patch<ApiRow>(`/appointments/${appointment.id}/status`, { status })
      .pipe(map((row) => row as unknown as Appointment));
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/appointments/${id}`);
  }
}
