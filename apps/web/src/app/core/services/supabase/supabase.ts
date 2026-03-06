import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '@env/environment';

@Injectable({ providedIn: 'root' })
export class Supabase {
  readonly client: SupabaseClient;

  constructor() {
    this.client = createClient(environment.supabase.url, environment.supabase.key);
  }
}
