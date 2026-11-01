import { inject, Injectable } from '@angular/core';
import { from, map, Observable, switchMap } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { ApiRow, decryptEntities, decryptEntity } from '@core/services/crypto/entity-crypto';
import { decryptList, mutateEncrypted } from '@core/services/crypto/crypto-transport';
import { validateList, validateOne } from '@core/services/crypto/validate-decrypted';
import { Medication, MedicationWithStock } from '../domain/models/medication.model';
import { MedicationGateway } from '../domain/gateways/medication.gateway';
import { MedicationSchema } from './schemas/medication.schema';

const CLEARTEXT_KEYS = ['id', 'userId', 'prescriptionId', 'patientId', 'createdAt'] as const;

// `daily_rate` est un `numeric` : Postgres le renvoie en chaîne, y compris dans le blob d'un compte
// passé du clair au chiffré. Idempotent.
function coerceMedication(row: ApiRow): Medication {
  const m = row as unknown as Medication;
  return { ...m, dailyRate: Number(m.dailyRate) };
}

@Injectable()
export class HttpMedicationGateway implements MedicationGateway {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  getAll(): Observable<Medication[]> {
    return this.api.getList<ApiRow>('/medications').pipe(
      switchMap((rows) => {
        const key = this.crypto.getMasterKey();
        if (!key || !rows[0]?.encryptedData) return from([rows.map(coerceMedication)]);
        return from(decryptEntities<ApiRow>(rows, key)).pipe(
          map((list) =>
            validateList(MedicationSchema, list.map(coerceMedication), { entity: 'Medication' }),
          ),
        );
      }),
    );
  }

  getById(id: string): Observable<Medication> {
    return this.api.get<ApiRow>(`/medications/${id}`).pipe(
      switchMap((row) => {
        const key = this.crypto.getMasterKey();
        if (!key || !row.encryptedData) return from([coerceMedication(row)]);
        return from(decryptEntity<ApiRow>(row, key)).pipe(
          map((m) => validateOne(MedicationSchema, coerceMedication(m), { entity: 'Medication' })),
        );
      }),
    );
  }

  getAlerts(): Observable<MedicationWithStock[]> {
    return decryptList<MedicationWithStock>(
      this.api.getList<ApiRow>('/medications/alerts'),
      this.crypto.getMasterKey(),
    );
  }

  create(data: Omit<Medication, 'id'>): Observable<Medication> {
    return mutateEncrypted(
      data as Record<string, unknown>,
      CLEARTEXT_KEYS,
      this.crypto.getMasterKey(),
      (body) => this.api.post<ApiRow>('/medications', body),
    );
  }

  update(id: string, data: Partial<Omit<Medication, 'id'>>): Observable<Medication> {
    return mutateEncrypted(
      data as Record<string, unknown>,
      CLEARTEXT_KEYS,
      this.crypto.getMasterKey(),
      (body) => this.api.put<ApiRow>(`/medications/${id}`, body),
      { rowId: id },
    );
  }

  refill(medication: Medication, quantity: number): Observable<Medication> {
    const key = this.crypto.getMasterKey();
    if (key) {
      // E2EE : `quantity` vit dans le blob, le PATCH serveur n'y a pas accès (il attendait un
      // entier en clair et répondait 400). On rechiffre le médicament avec le nouveau stock.
      const { id, ...rest } = medication;
      return this.update(id, { ...rest, quantity: medication.quantity + quantity });
    }
    return this.api
      .patch<ApiRow>(`/medications/${medication.id}/refill`, { quantity })
      .pipe(map((row) => row as unknown as Medication));
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/medications/${id}`);
  }
}
