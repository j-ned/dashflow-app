import { inject, Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { Supabase } from '@core/services/supabase/supabase';
import { TABLE_NAMES } from '@core/services/supabase/table-names';
import { Consumable } from '../domain/models/consumable.model';
import { ConsumableGateway } from '../domain/gateways/consumable.gateway';

@Injectable()
export class SupabaseConsumableGateway extends ConsumableGateway {
  private readonly supabase = inject(Supabase);

  getAll(): Observable<Consumable[]> {
    return from(
      this.supabase.client.from(TABLE_NAMES.CONSUMABLES).select('*').limit(100)
    ).pipe(map(({ data, error }) => {
      if (error) throw error;
      return data as Consumable[];
    }));
  }

  getById(id: string): Observable<Consumable> {
    return from(
      this.supabase.client.from(TABLE_NAMES.CONSUMABLES).select('*').eq('id', id).single()
    ).pipe(map(({ data, error }) => {
      if (error) throw error;
      return data as Consumable;
    }));
  }

  create(data: Omit<Consumable, 'id'>): Observable<Consumable> {
    return from(
      this.supabase.client.from(TABLE_NAMES.CONSUMABLES).insert({
        name: data.name,
        category: data.category,
        quantity: data.quantity,
        minThreshold: data.minThreshold,
        unitPrice: data.unitPrice,
        lastRestocked: data.lastRestocked,
        installedAt: data.installedAt,
        estimatedLifetimeDays: data.estimatedLifetimeDays,
      }).select().single()
    ).pipe(map(({ data: row, error }) => {
      if (error) throw error;
      return row as Consumable;
    }));
  }

  update(id: string, data: Partial<Omit<Consumable, 'id'>>): Observable<Consumable> {
    return from(
      this.supabase.client.from(TABLE_NAMES.CONSUMABLES)
        .update(data)
        .eq('id', id)
        .select()
        .single()
    ).pipe(map(({ data: row, error }) => {
      if (error) throw error;
      return row as Consumable;
    }));
  }

  updateQuantity(id: string, quantity: number): Observable<Consumable> {
    return from(
      this.supabase.client.from(TABLE_NAMES.CONSUMABLES)
        .update({ quantity })
        .eq('id', id)
        .select()
        .single()
    ).pipe(map(({ data, error }) => {
      if (error) throw error;
      return data as Consumable;
    }));
  }

  install(id: string, installedAt: string, estimatedLifetimeDays: number): Observable<Consumable> {
    return from(
      this.supabase.client.from(TABLE_NAMES.CONSUMABLES)
        .update({ installedAt, estimatedLifetimeDays })
        .eq('id', id)
        .select()
        .single()
    ).pipe(map(({ data, error }) => {
      if (error) throw error;
      return data as Consumable;
    }));
  }

  delete(id: string): Observable<void> {
    return from(
      this.supabase.client.from(TABLE_NAMES.CONSUMABLES).delete().eq('id', id)
    ).pipe(map(({ error }) => {
      if (error) throw error;
    }));
  }
}
