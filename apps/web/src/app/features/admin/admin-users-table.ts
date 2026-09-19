import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import type { AccountSecurity, AdminUserView } from '@core/admin/admin.types';

const BADGE_CLASS: Record<AccountSecurity['status'], string> = {
  ok: 'border-ib-green-20 bg-ib-green-10 text-ib-green',
  recommended: 'border-ib-yellow-20 bg-ib-yellow-10 text-ib-yellow',
  action: 'border-ib-red-20 bg-ib-red-10 text-ib-red',
  exempt: 'border-border text-text-muted',
};

const COLUMN_COUNT = 6;

@Component({
  selector: 'app-admin-users-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full overflow-x-auto' },
  imports: [DatePipe, TranslocoPipe],
  template: `
    <table class="w-full text-sm">
      <caption class="sr-only">
        {{
          'admin.tableCaption' | transloco
        }}
      </caption>
      <thead>
        <tr class="border-b border-border text-left">
          <th scope="col" class="w-10 px-3 py-2">
            <span class="sr-only">{{ 'admin.col.select' | transloco }}</span>
          </th>
          <th scope="col" class="px-3 py-2 font-medium text-text-muted">
            {{ 'admin.col.email' | transloco }}
          </th>
          <th scope="col" class="px-3 py-2 font-medium text-text-muted">
            {{ 'admin.col.security' | transloco }}
          </th>
          <th scope="col" class="px-3 py-2 font-medium text-text-muted">
            {{ 'admin.col.role' | transloco }}
          </th>
          <th scope="col" class="px-3 py-2 font-medium text-text-muted">
            {{ 'admin.col.demo' | transloco }}
          </th>
          <th scope="col" class="px-3 py-2 font-medium text-text-muted">
            {{ 'admin.col.createdAt' | transloco }}
          </th>
        </tr>
      </thead>
      <tbody>
        @if (loading()) {
          @for (row of skeletonRows; track row) {
            <tr class="border-b border-border" data-testid="admin-skeleton-row">
              <td [attr.colspan]="columnCount" class="px-3 py-3">
                <span class="block h-4 w-full animate-pulse rounded bg-hover"></span>
              </td>
            </tr>
          }
        } @else if (users().length === 0) {
          <tr data-testid="admin-empty-row">
            <td [attr.colspan]="columnCount" class="px-3 py-8 text-center text-text-muted">
              {{ 'admin.empty' | transloco }}
            </td>
          </tr>
        } @else {
          @for (u of users(); track u.id) {
            <tr
              class="border-b border-border transition-colors"
              data-testid="admin-user-row"
              [attr.data-user-id]="u.id"
              [class.bg-ib-blue-5]="selectedIds().has(u.id)"
            >
              <td class="px-3 py-2">
                <!-- Un compte à jour ou de démo n'a rien à recevoir : pas de case à cocher. -->
                @if (u.security.issues.length > 0) {
                  <input
                    type="checkbox"
                    class="h-4 w-4 cursor-pointer accent-ib-blue"
                    data-testid="admin-select-user"
                    [checked]="selectedIds().has(u.id)"
                    [attr.aria-label]="'admin.selectUser' | transloco: { email: u.email }"
                    (change)="toggleSelect.emit(u.id)"
                  />
                }
              </td>
              <th scope="row" class="px-3 py-2 text-left font-normal text-text-primary">
                {{ u.email }}
              </th>
              <td class="px-3 py-2">
                <span
                  class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-tight"
                  data-testid="admin-security-badge"
                  [attr.data-status]="u.security.status"
                  [class]="badgeClass(u.security.status)"
                >
                  <span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>
                  {{ 'admin.security.status.' + u.security.status | transloco }}
                </span>
                @if (u.security.issues.length > 0) {
                  <ul class="mt-1 flex flex-col gap-0.5 text-xs text-text-muted">
                    @for (issue of u.security.issues; track issue.reason) {
                      <li>{{ 'admin.security.issue.' + issue.reason | transloco }}</li>
                    }
                  </ul>
                }
                @if (u.lastNotice; as notice) {
                  <p class="mt-1 text-xs text-text-muted" data-testid="admin-last-notice">
                    {{
                      'admin.security.lastNotice'
                        | transloco
                          : {
                              reason: ('admin.notices.reason.' + notice.reason | transloco),
                              date: (notice.at | date: 'd MMM'),
                            }
                    }}
                  </p>
                }
              </td>
              <td class="px-3 py-2">
                <span
                  class="inline-flex items-center rounded-sm border border-border px-2 py-0.5 text-[11px] font-semibold leading-tight"
                  [class]="
                    u.role === 'admin'
                      ? 'border-ib-blue-20 bg-ib-blue-10 text-ib-blue'
                      : 'text-text-muted'
                  "
                >
                  {{ 'admin.role.' + u.role | transloco }}
                </span>
              </td>
              <td class="px-3 py-2">
                @if (u.isDemoAccount) {
                  <span
                    class="inline-flex items-center rounded-sm border border-border px-2 py-0.5 text-[11px] font-semibold leading-tight text-text-muted"
                  >
                    {{ 'admin.demoBadge' | transloco }}
                  </span>
                }
              </td>
              <td class="px-3 py-2 tabular-nums text-text-muted">
                {{ u.createdAt | date: 'shortDate' }}
              </td>
            </tr>
          }
        }
      </tbody>
    </table>

    <nav
      class="mt-4 flex items-center justify-between"
      [attr.aria-label]="'admin.pagination.label' | transloco"
    >
      <button
        type="button"
        class="btn-cancel min-h-11"
        data-testid="admin-prev-page"
        [disabled]="page() <= 1 || loading()"
        (click)="pageChange.emit(page() - 1)"
      >
        {{ 'admin.pagination.prev' | transloco }}
      </button>
      <span class="text-sm text-text-muted tabular-nums" data-testid="admin-page-info">
        {{ 'admin.pagination.page' | transloco: { page: page(), pages: totalPages() } }}
      </span>
      <button
        type="button"
        class="btn-cancel min-h-11"
        data-testid="admin-next-page"
        [disabled]="page() >= totalPages() || loading()"
        (click)="pageChange.emit(page() + 1)"
      >
        {{ 'admin.pagination.next' | transloco }}
      </button>
    </nav>
  `,
})
export class AdminUsersTable {
  readonly users = input.required<readonly AdminUserView[]>();
  readonly total = input.required<number>();
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly loading = input(false);
  readonly selectedIds = input<ReadonlySet<string>>(new Set());

  readonly toggleSelect = output<string>();

  readonly pageChange = output<number>();

  protected readonly columnCount = COLUMN_COUNT;

  protected badgeClass(status: AccountSecurity['status']): string {
    return BADGE_CLASS[status];
  }
  protected readonly skeletonRows = Array.from({ length: 5 }, (_, i) => i);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize())),
  );
}
