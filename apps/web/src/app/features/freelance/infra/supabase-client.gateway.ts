import { inject, Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { Supabase } from '@core/services/supabase/supabase';
import { TABLE_NAMES } from '@core/services/supabase/table-names';
import { Client } from '../domain/models/client.model';
import { ClientGateway } from '../domain/gateways/client.gateway';

@Injectable()
export class SupabaseClientGateway extends ClientGateway {
  private readonly supabase = inject(Supabase);

  getAll(): Observable<Client[]> {
    return from(
      this.supabase.client.from(TABLE_NAMES.CLIENTS).select('*').limit(100)
    ).pipe(map(({ data, error }) => {
      if (error) throw error;
      return data as Client[];
    }));
  }

  getById(id: string): Observable<Client> {
    return from(
      this.supabase.client.from(TABLE_NAMES.CLIENTS).select('*').eq('id', id).single()
    ).pipe(map(({ data, error }) => {
      if (error) throw error;
      return data as Client;
    }));
  }

  create(data: Omit<Client, 'id' | 'createdAt'>): Observable<Client> {
    return from(
      this.supabase.client.from(TABLE_NAMES.CLIENTS).insert({
        name: data.name,
        email: data.email,
        phone: data.phone,
        company: data.company,
        address: data.address,
        notes: data.notes,
        createdAt: new Date().toISOString(),
      }).select().single()
    ).pipe(map(({ data: row, error }) => {
      if (error) throw error;
      return row as Client;
    }));
  }

  update(id: string, data: Partial<Client>): Observable<Client> {
    const { id: _id, ...payload } = data;
    return from(
      this.supabase.client.from(TABLE_NAMES.CLIENTS)
        .update(payload)
        .eq('id', id)
        .select()
        .single()
    ).pipe(map(({ data: row, error }) => {
      if (error) throw error;
      return row as Client;
    }));
  }

  delete(id: string): Observable<void> {
    return from(
      this.supabase.client.from(TABLE_NAMES.CLIENTS).delete().eq('id', id)
    ).pipe(map(({ error }) => {
      if (error) throw error;
    }));
  }
}
