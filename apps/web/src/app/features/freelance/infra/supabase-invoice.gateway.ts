import { inject, Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { Supabase } from '@core/services/supabase/supabase';
import { TABLE_NAMES } from '@core/services/supabase/table-names';
import { Invoice, InvoiceStatus } from '../domain/models/invoice.model';
import { InvoiceGateway } from '../domain/gateways/invoice.gateway';

function generateReference(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const r = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `FAC-${y}${m}-${r}`;
}

@Injectable()
export class SupabaseInvoiceGateway extends InvoiceGateway {
  private readonly supabase = inject(Supabase);

  getAll(): Observable<Invoice[]> {
    return from(
      this.supabase.client.from(TABLE_NAMES.INVOICES).select('*').limit(100)
    ).pipe(map(({ data, error }) => {
      if (error) throw error;
      return (data as Record<string, unknown>[]).map(row => ({
        ...row,
        lines: typeof row['lines'] === 'string' ? JSON.parse(row['lines'] as string) : row['lines'],
      })) as Invoice[];
    }));
  }

  getById(id: string): Observable<Invoice> {
    return from(
      this.supabase.client.from(TABLE_NAMES.INVOICES).select('*').eq('id', id).single()
    ).pipe(map(({ data, error }) => {
      if (error) throw error;
      const row = data as Record<string, unknown>;
      return {
        ...row,
        lines: typeof row['lines'] === 'string' ? JSON.parse(row['lines'] as string) : row['lines'],
      } as Invoice;
    }));
  }

  create(data: Omit<Invoice, 'id' | 'reference' | 'paidAt'>): Observable<Invoice> {
    return from(
      this.supabase.client.from(TABLE_NAMES.INVOICES).insert({
        reference: generateReference(),
        clientId: data.clientId,
        clientName: data.clientName,
        status: data.status,
        lines: JSON.stringify(data.lines),
        totalHt: data.totalHt,
        issuedAt: data.issuedAt,
        dueDate: data.dueDate,
        notes: data.notes,
      }).select().single()
    ).pipe(map(({ data: row, error }) => {
      if (error) throw error;
      const r = row as Record<string, unknown>;
      return {
        ...r,
        lines: typeof r['lines'] === 'string' ? JSON.parse(r['lines'] as string) : r['lines'],
      } as Invoice;
    }));
  }

  updateStatus(id: string, status: InvoiceStatus): Observable<Invoice> {
    return from(
      this.supabase.client.from(TABLE_NAMES.INVOICES)
        .update({
          status,
          paidAt: status === 'paid' ? new Date().toISOString() : null,
        })
        .eq('id', id)
        .select()
        .single()
    ).pipe(map(({ data, error }) => {
      if (error) throw error;
      const row = data as Record<string, unknown>;
      return {
        ...row,
        lines: typeof row['lines'] === 'string' ? JSON.parse(row['lines'] as string) : row['lines'],
      } as Invoice;
    }));
  }

  delete(id: string): Observable<void> {
    return from(
      this.supabase.client.from(TABLE_NAMES.INVOICES).delete().eq('id', id)
    ).pipe(map(({ error }) => {
      if (error) throw error;
    }));
  }
}
