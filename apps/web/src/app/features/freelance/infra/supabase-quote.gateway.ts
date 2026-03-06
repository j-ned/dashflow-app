import { inject, Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { Supabase } from '@core/services/supabase/supabase';
import { TABLE_NAMES } from '@core/services/supabase/table-names';
import { Quote, QuoteStatus } from '../domain/models/quote.model';
import { QuoteGateway } from '../domain/gateways/quote.gateway';

function generateReference(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const r = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `DEV-${y}${m}-${r}`;
}

@Injectable()
export class SupabaseQuoteGateway extends QuoteGateway {
  private readonly supabase = inject(Supabase);

  getAll(): Observable<Quote[]> {
    return from(
      this.supabase.client.from(TABLE_NAMES.QUOTES).select('*').limit(100)
    ).pipe(map(({ data, error }) => {
      if (error) throw error;
      return (data as Record<string, unknown>[]).map(row => ({
        ...row,
        lines: typeof row['lines'] === 'string' ? JSON.parse(row['lines'] as string) : row['lines'],
      })) as Quote[];
    }));
  }

  getById(id: string): Observable<Quote> {
    return from(
      this.supabase.client.from(TABLE_NAMES.QUOTES).select('*').eq('id', id).single()
    ).pipe(map(({ data, error }) => {
      if (error) throw error;
      const row = data as Record<string, unknown>;
      return {
        ...row,
        lines: typeof row['lines'] === 'string' ? JSON.parse(row['lines'] as string) : row['lines'],
      } as Quote;
    }));
  }

  create(data: Omit<Quote, 'id' | 'reference'>): Observable<Quote> {
    return from(
      this.supabase.client.from(TABLE_NAMES.QUOTES).insert({
        reference: generateReference(),
        clientId: data.clientId,
        clientName: data.clientName,
        status: data.status,
        lines: JSON.stringify(data.lines),
        totalHt: data.totalHt,
        issuedAt: data.issuedAt,
        validUntil: data.validUntil,
        notes: data.notes,
      }).select().single()
    ).pipe(map(({ data: row, error }) => {
      if (error) throw error;
      const r = row as Record<string, unknown>;
      return {
        ...r,
        lines: typeof r['lines'] === 'string' ? JSON.parse(r['lines'] as string) : r['lines'],
      } as Quote;
    }));
  }

  updateStatus(id: string, status: QuoteStatus): Observable<Quote> {
    return from(
      this.supabase.client.from(TABLE_NAMES.QUOTES)
        .update({ status })
        .eq('id', id)
        .select()
        .single()
    ).pipe(map(({ data, error }) => {
      if (error) throw error;
      const row = data as Record<string, unknown>;
      return {
        ...row,
        lines: typeof row['lines'] === 'string' ? JSON.parse(row['lines'] as string) : row['lines'],
      } as Quote;
    }));
  }

  delete(id: string): Observable<void> {
    return from(
      this.supabase.client.from(TABLE_NAMES.QUOTES).delete().eq('id', id)
    ).pipe(map(({ error }) => {
      if (error) throw error;
    }));
  }
}
