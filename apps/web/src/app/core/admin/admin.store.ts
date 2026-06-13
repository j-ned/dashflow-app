import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { Toaster } from '@shared/components/toast/toast';
import type { AdminMetrics, AdminUsersPage, AdminUserView, PlanKey } from './admin.types';

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
  private readonly _metrics = signal<AdminMetrics | null>(null);
  private readonly _loading = signal(false);
  private _lastQuery: LoadUsersOpts = {};

  readonly users = this._users.asReadonly();
  readonly total = this._total.asReadonly();
  readonly metrics = this._metrics.asReadonly();
  readonly loading = this._loading.asReadonly();

  async loadUsers(opts: LoadUsersOpts): Promise<void> {
    this._lastQuery = opts;
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

  async loadMetrics(): Promise<void> {
    try {
      const metrics = await firstValueFrom(this.api.get<AdminMetrics>('/admin/metrics'));
      this._metrics.set(metrics);
    } catch {
      this.toaster.error('admin.toast.metricsError');
    }
  }

  async overridePlan(userId: string, planKey: PlanKey): Promise<void> {
    try {
      await firstValueFrom(this.api.patch(`/admin/users/${userId}/plan`, { planKey }));
    } catch {
      this.toaster.error('admin.toast.overrideError');
      return;
    }
    this.toaster.success('admin.toast.overrideOk');
    await this.loadUsers(this._lastQuery);
    await this.loadMetrics();
  }
}
