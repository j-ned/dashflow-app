import { inject, Injectable } from '@angular/core';
import { from, Observable, switchMap } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { ApiRow, encryptEntity } from '@core/services/crypto/entity-crypto';
import { decryptBlob, decryptList, decryptOne } from '@core/services/crypto/crypto-transport';
import { encryptFile } from '@core/services/crypto/file-crypto';
import { SalaryArchive } from '../domain/models/salary-archive.model';
import { SalaryArchiveGateway } from '../domain/gateways/salary-archive.gateway';

const CLEARTEXT_KEYS = ['id', 'userId', 'accountId', 'createdAt'] as const;

@Injectable()
export class HttpSalaryArchiveGateway implements SalaryArchiveGateway {
  private readonly api = inject(ApiClient);
  private readonly crypto = inject(CryptoStore);

  getAll(): Observable<SalaryArchive[]> {
    return decryptList(this.api.get<ApiRow[]>('/salary-archives'), this.crypto.getMasterKey());
  }

  create(data: FormData): Observable<SalaryArchive> {
    const key = this.crypto.getMasterKey();
    if (!key) return this.api.postForm('/salary-archives', data);

    const file = data.get('file') as File | null;
    const jsonFields: Record<string, unknown> = {};
    data.forEach((value, field) => {
      if (field !== 'file') jsonFields[field] = value;
    });

    const response$ = from(encryptEntity(jsonFields, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => {
        const fd = new FormData();
        if (file) {
          return from(encryptFile(file, key)).pipe(
            switchMap((encryptedBlob) => {
              fd.append(
                'file',
                new File([encryptedBlob], file.name, { type: 'application/octet-stream' }),
              );
              fd.append('originalMimeType', file.type);
              fd.append('encrypted', 'true');
              fd.append('encryptedData', encrypted.encryptedData as string);
              for (const k of CLEARTEXT_KEYS) {
                if (encrypted[k as string] !== undefined) {
                  fd.append(k as string, String(encrypted[k as string]));
                }
              }
              return this.api.postForm<ApiRow>('/salary-archives', fd);
            }),
          );
        }
        Object.entries(encrypted).forEach(([k, v]) => fd.append(k, String(v)));
        return this.api.postForm<ApiRow>('/salary-archives', fd);
      }),
    );

    return decryptOne<SalaryArchive>(response$, key);
  }

  update(id: string, archive: SalaryArchive): Observable<SalaryArchive> {
    const key = this.crypto.getMasterKey();
    // On renvoie l'intégralité des champs JSON : en E2EE le PUT remplace tout encryptedData,
    // donc dépenses + clé de fiche de paie doivent être ré-incluses pour être conservées.
    const fields: Record<string, unknown> = {
      month: archive.month,
      salary: String(archive.salary),
      totalExpenses: String(archive.totalExpenses),
      totalSpendings: String(archive.totalSpendings),
      spendings: archive.spendings,
      accountId: archive.accountId,
      payslipKey: archive.payslipKey,
    };
    if (!key) return this.api.put(`/salary-archives/${id}`, fields);

    const response$ = from(encryptEntity(fields, CLEARTEXT_KEYS, key)).pipe(
      switchMap((encrypted) => this.api.put<ApiRow>(`/salary-archives/${id}`, encrypted)),
    );
    return decryptOne<SalaryArchive>(response$, key);
  }

  delete(id: string): Observable<void> {
    return this.api.delete(`/salary-archives/${id}`);
  }

  downloadPayslip(id: string): Observable<Blob> {
    return decryptBlob(
      this.api.getBlob(`/salary-archives/${id}/payslip`),
      this.crypto.getMasterKey(),
      'application/pdf',
    );
  }
}
