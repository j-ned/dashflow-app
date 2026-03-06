import { inject, Injectable } from '@angular/core';
import { from, map, Observable, switchMap } from 'rxjs';
import { Supabase } from '@core/services/supabase/supabase';
import { TABLE_NAMES } from '@core/services/supabase/table-names';
import { Envelope } from '../domain/models/envelope.model';
import { EnvelopeGateway } from '../domain/gateways/envelope.gateway';

@Injectable()
export class SupabaseEnvelopeGateway extends EnvelopeGateway {
  private readonly supabase = inject(Supabase);

  getAll(): Observable<Envelope[]> {
    return from(
      this.supabase.client.from(TABLE_NAMES.ENVELOPES).select('*').limit(100)
    ).pipe(map(({ data, error }) => {
      if (error) throw error;
      return data as Envelope[];
    }));
  }

  getById(id: string): Observable<Envelope> {
    return from(
      this.supabase.client.from(TABLE_NAMES.ENVELOPES).select('*').eq('id', id).single()
    ).pipe(map(({ data, error }) => {
      if (error) throw error;
      return data as Envelope;
    }));
  }

  create(data: Omit<Envelope, 'id'>): Observable<Envelope> {
    return from(
      this.supabase.client.from(TABLE_NAMES.ENVELOPES).insert({
        name: data.name,
        type: data.type,
        balance: data.balance,
        target: data.target,
        color: data.color,
      }).select().single()
    ).pipe(map(({ data: row, error }) => {
      if (error) throw error;
      return row as Envelope;
    }));
  }

  update(id: string, data: Partial<Omit<Envelope, 'id'>>): Observable<Envelope> {
    return from(
      this.supabase.client.from(TABLE_NAMES.ENVELOPES)
        .update(data)
        .eq('id', id)
        .select()
        .single()
    ).pipe(map(({ data: row, error }) => {
      if (error) throw error;
      return row as Envelope;
    }));
  }

  updateBalance(id: string, amount: number): Observable<Envelope> {
    return this.getById(id).pipe(
      switchMap(envelope =>
        from(
          this.supabase.client.from(TABLE_NAMES.ENVELOPES)
            .update({ balance: envelope.balance + amount })
            .eq('id', id)
            .select()
            .single()
        )
      ),
      map(({ data, error }) => {
        if (error) throw error;
        return data as Envelope;
      }),
    );
  }

  delete(id: string): Observable<void> {
    return from(
      this.supabase.client.from(TABLE_NAMES.ENVELOPES).delete().eq('id', id)
    ).pipe(map(({ error }) => {
      if (error) throw error;
    }));
  }
}
