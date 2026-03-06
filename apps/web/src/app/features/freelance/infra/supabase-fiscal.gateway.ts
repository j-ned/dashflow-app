import { inject, Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { Supabase } from '@core/services/supabase/supabase';
import { TABLE_NAMES } from '@core/services/supabase/table-names';
import { FiscalPeriod } from '../domain/models/fiscal-period.model';
import { FiscalGateway } from '../domain/gateways/fiscal.gateway';

@Injectable()
export class SupabaseFiscalGateway extends FiscalGateway {
  private readonly supabase = inject(Supabase);

  getAll(): Observable<FiscalPeriod[]> {
    return from(
      this.supabase.client.from(TABLE_NAMES.FISCAL_PERIODS).select('*').limit(100)
    ).pipe(map(({ data, error }) => {
      if (error) throw error;
      return data as FiscalPeriod[];
    }));
  }

  getByQuarter(year: number, quarter: string): Observable<FiscalPeriod> {
    return from(
      this.supabase.client.from(TABLE_NAMES.FISCAL_PERIODS)
        .select('*')
        .eq('year', year)
        .eq('quarter', quarter)
        .limit(1)
        .single()
    ).pipe(map(({ data, error }) => {
      if (error) throw error;
      return data as FiscalPeriod;
    }));
  }

  updateProvision(id: string, amount: number): Observable<FiscalPeriod> {
    return from(
      this.supabase.client.from(TABLE_NAMES.FISCAL_PERIODS)
        .update({ provisioned: amount })
        .eq('id', id)
        .select()
        .single()
    ).pipe(map(({ data, error }) => {
      if (error) throw error;
      return data as FiscalPeriod;
    }));
  }

  markDeclared(id: string): Observable<FiscalPeriod> {
    return from(
      this.supabase.client.from(TABLE_NAMES.FISCAL_PERIODS)
        .update({ declaredAt: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
    ).pipe(map(({ data, error }) => {
      if (error) throw error;
      return data as FiscalPeriod;
    }));
  }
}
