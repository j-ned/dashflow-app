import { inject, Injectable } from '@angular/core';
import { from, map, Observable, switchMap } from 'rxjs';
import { Supabase } from '@core/services/supabase/supabase';
import { TABLE_NAMES } from '@core/services/supabase/table-names';
import { Loan } from '../domain/models/loan.model';
import { LoanGateway } from '../domain/gateways/loan.gateway';

@Injectable()
export class SupabaseLoanGateway extends LoanGateway {
  private readonly supabase = inject(Supabase);

  getAll(): Observable<Loan[]> {
    return from(
      this.supabase.client.from(TABLE_NAMES.LOANS).select('*').limit(100)
    ).pipe(map(({ data, error }) => {
      if (error) throw error;
      return data as Loan[];
    }));
  }

  getById(id: string): Observable<Loan> {
    return from(
      this.supabase.client.from(TABLE_NAMES.LOANS).select('*').eq('id', id).single()
    ).pipe(map(({ data, error }) => {
      if (error) throw error;
      return data as Loan;
    }));
  }

  create(data: Omit<Loan, 'id'>): Observable<Loan> {
    return from(
      this.supabase.client.from(TABLE_NAMES.LOANS).insert({
        person: data.person,
        direction: data.direction,
        amount: data.amount,
        remaining: data.remaining,
        description: data.description,
        date: data.date,
        dueDate: data.dueDate,
      }).select().single()
    ).pipe(map(({ data: row, error }) => {
      if (error) throw error;
      return row as Loan;
    }));
  }

  update(id: string, data: Partial<Omit<Loan, 'id'>>): Observable<Loan> {
    return from(
      this.supabase.client.from(TABLE_NAMES.LOANS)
        .update(data)
        .eq('id', id)
        .select()
        .single()
    ).pipe(map(({ data: row, error }) => {
      if (error) throw error;
      return row as Loan;
    }));
  }

  recordPayment(id: string, amount: number): Observable<Loan> {
    return this.getById(id).pipe(
      switchMap(loan =>
        from(
          this.supabase.client.from(TABLE_NAMES.LOANS)
            .update({ remaining: Math.max(0, loan.remaining - amount) })
            .eq('id', id)
            .select()
            .single()
        )
      ),
      map(({ data, error }) => {
        if (error) throw error;
        return data as Loan;
      }),
    );
  }

  delete(id: string): Observable<void> {
    return from(
      this.supabase.client.from(TABLE_NAMES.LOANS).delete().eq('id', id)
    ).pipe(map(({ error }) => {
      if (error) throw error;
    }));
  }
}
