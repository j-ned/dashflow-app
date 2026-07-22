import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import type { AdminUserView } from '@core/admin/admin.types';

const COLUMN_COUNT = 4;

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
          <th scope="col" class="px-3 py-2 font-medium text-text-muted">
            {{ 'admin.col.email' | transloco }}
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
            >
              <th scope="row" class="px-3 py-2 text-left font-normal text-text-primary">
                {{ u.email }}
              </th>
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

  readonly pageChange = output<number>();

  protected readonly columnCount = COLUMN_COUNT;
  protected readonly skeletonRows = Array.from({ length: 5 }, (_, i) => i);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize())),
  );
}
