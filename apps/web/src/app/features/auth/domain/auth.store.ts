import { computed, inject, Injectable, signal } from '@angular/core';
import { Supabase } from '@core/services/supabase/supabase';
import { BUCKET_NAMES } from '@core/services/supabase/table-names';
import { User } from '@supabase/supabase-js';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly supabase = inject(Supabase);

  private readonly _user = signal<User | null>(null);
  private readonly _isAuthenticated = signal(false);
  private readonly _isLoading = signal(true);

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = this._isAuthenticated.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  readonly email = computed(() => this._user()?.email ?? '');
  readonly displayName = computed(() => {
    const user = this._user();
    return user?.user_metadata?.['display_name'] ?? user?.email?.split('@')[0] ?? '';
  });
  readonly avatarUrl = computed(() => this._user()?.user_metadata?.['avatar_url'] ?? null);
  readonly userInitial = computed(() => {
    const name = this.displayName();
    return name ? name.charAt(0).toUpperCase() : '?';
  });

  constructor() {
    this.checkSession();

    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      this._user.set(session?.user ?? null);
      this._isAuthenticated.set(!!session?.user);
    });
  }

  async checkSession(): Promise<void> {
    this._isLoading.set(true);
    try {
      const { data: { user } } = await this.supabase.client.auth.getUser();
      this._user.set(user);
      this._isAuthenticated.set(!!user);
    } catch {
      this._user.set(null);
      this._isAuthenticated.set(false);
    } finally {
      this._isLoading.set(false);
    }
  }

  async login(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const { data: { user } } = await this.supabase.client.auth.getUser();
    this._user.set(user);
    this._isAuthenticated.set(true);
  }

  async logout(): Promise<void> {
    await this.supabase.client.auth.signOut();
    this._user.set(null);
    this._isAuthenticated.set(false);
  }

  async updateProfile(data: { display_name?: string }): Promise<void> {
    const { error } = await this.supabase.client.auth.updateUser({ data });
    if (error) throw error;
    await this.checkSession();
  }

  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await this.supabase.client.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  async uploadAvatar(file: File): Promise<string> {
    const user = this._user();
    if (!user) throw new Error('Non authentifié');
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await this.supabase.client.storage
      .from(BUCKET_NAMES.AVATARS)
      .upload(path, file, { upsert: true });
    if (uploadError) throw uploadError;
    const { data } = this.supabase.client.storage.from(BUCKET_NAMES.AVATARS).getPublicUrl(path);
    const url = `${data.publicUrl}?t=${Date.now()}`;
    await this.supabase.client.auth.updateUser({ data: { avatar_url: url } });
    await this.checkSession();
    return url;
  }

  async getMfaFactors(): Promise<{ id: string; status: string }[]> {
    const { data, error } = await this.supabase.client.auth.mfa.listFactors();
    if (error) throw error;
    return data.totp ?? [];
  }

  async enrollTotp(): Promise<{ id: string; qrCode: string; secret: string }> {
    const { data, error } = await this.supabase.client.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Authenticator',
    });
    if (error) throw error;
    return {
      id: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    };
  }

  async verifyTotp(factorId: string, code: string): Promise<void> {
    const { data: challenge, error: challengeError } =
      await this.supabase.client.auth.mfa.challenge({ factorId });
    if (challengeError) throw challengeError;
    const { error } = await this.supabase.client.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (error) throw error;
  }

  async unenrollTotp(factorId: string): Promise<void> {
    const { error } = await this.supabase.client.auth.mfa.unenroll({ factorId });
    if (error) throw error;
  }

  /**
   * Supprime le compte utilisateur.
   * Requiert une fonction RPC Supabase `delete_own_account` :
   *
   * CREATE OR REPLACE FUNCTION public.delete_own_account()
   * RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
   *   DELETE FROM auth.users WHERE id = auth.uid();
   * $$;
   */
  async deleteAccount(): Promise<void> {
    const { error } = await this.supabase.client.rpc('delete_own_account');
    if (error) throw error;
    await this.logout();
  }
}
