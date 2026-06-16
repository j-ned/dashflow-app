import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { Toaster } from '@shared/components/toast/toast';
import type { AdminUsersPage, AdminUserView } from './admin.types';

type LoadUsersOpts = {
  search?: string;
  page?: number;
  pageSize?: number;
};

@Injectable({ providedIn: 'root' })
export class AdminStore {
  private readonly api = inject(ApiClient);
  private readonly toaster = inject(Toaster);

  private readonly _users = signal<readonly AdminUserView[]>([]);
  private readonly _total = signal(0);
  private readonly _loading = signal(false);

  readonly users = this._users.asReadonly();
  readonly total = this._total.asReadonly();
  readonly loading = this._loading.asReadonly();

  async loadUsers(opts: LoadUsersOpts): Promise<void> {
    this._loading.set(true);
    const params: Record<string, string | number> = {};
    if (opts.search !== undefined) params['search'] = opts.search;
    if (opts.page !== undefined) params['page'] = opts.page;
    if (opts.pageSize !== undefined) params['pageSize'] = opts.pageSize;
    try {
      const page = await firstValueFrom(this.api.get<AdminUsersPage>('/admin/users', params));
      this._users.set(page.items);
      this._total.set(page.total);
    } catch {
      this.toaster.error('admin.toast.usersError');
    } finally {
      this._loading.set(false);
    }
  }
}
