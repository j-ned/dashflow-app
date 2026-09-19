import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { Toaster } from '@shared/components/toast/toast';
import type {
  AdminUsersPage,
  AdminUserView,
  DeleteUsersResult,
  NoticeReason,
  NoticeSummary,
  SendNoticesResult,
} from './admin.types';

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
  private readonly _summary = signal<NoticeSummary | null>(null);
  private readonly _sending = signal(false);

  readonly users = this._users.asReadonly();
  readonly total = this._total.asReadonly();
  readonly loading = this._loading.asReadonly();
  /** Par motif : comptes concernés et comptes encore dans le délai de 7 jours. */
  readonly summary = this._summary.asReadonly();
  readonly sending = this._sending.asReadonly();

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

  async loadSummary(): Promise<void> {
    try {
      this._summary.set(
        await firstValueFrom(this.api.get<NoticeSummary>('/admin/notices/summary')),
      );
    } catch {
      this._summary.set(null);
    }
  }

  /** Sans `userIds` : tous les comptes concernés par le motif. Rend `null` si l'envoi a échoué. */
  async sendNotices(
    reason: NoticeReason,
    userIds?: readonly string[],
  ): Promise<SendNoticesResult | null> {
    this._sending.set(true);
    try {
      return await firstValueFrom(
        this.api.post<SendNoticesResult>(
          '/admin/notices',
          userIds ? { reason, userIds } : { reason },
        ),
      );
    } catch {
      this.toaster.error('admin.notices.toast.error');
      return null;
    } finally {
      this._sending.set(false);
    }
  }

  /** Supprime des comptes jamais vérifiés. Rend `null` si la requête a échoué. */
  async deleteUnverified(userIds: readonly string[]): Promise<DeleteUsersResult | null> {
    this._sending.set(true);
    try {
      return await firstValueFrom(
        this.api.post<DeleteUsersResult>('/admin/users/delete-unverified', { userIds }),
      );
    } catch {
      this.toaster.error('admin.cleanup.toast.error');
      return null;
    } finally {
      this._sending.set(false);
    }
  }
}
