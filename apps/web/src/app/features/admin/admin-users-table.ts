import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { AdminPlanBadge } from './admin-plan-badge';
import { AdminStatusBadge } from './admin-status-badge';
import { AdminSourceBadge } from './admin-source-badge';
import type { AdminUserView, PlanKey } from '@core/admin/admin.types';

const PLAN_OPTIONS: readonly PlanKey[] = ['solo', 'family', 'family_health'];
const COLUMN_COUNT = 9;

export type OverrideRequest = { readonly userId: string; readonly planKey: PlanKey };

@Component({
  selector: 'app-admin-users-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full overflow-x-auto' },
  imports: [DatePipe, TranslocoPipe, AdminPlanBadge, AdminStatusBadge, AdminSourceBadge],
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
            {{ 'admin.col.plan' | transloco }}
          </th>
          <th scope="col" class="px-3 py-2 font-medium text-text-muted">
            {{ 'admin.col.status' | transloco }}
          </th>
          <th scope="col" class="px-3 py-2 font-medium text-text-muted">
            {{ 'admin.col.source' | transloco }}
          </th>
          <th scope="col" class="px-3 py-2 font-medium text-text-muted">
            {{ 'admin.col.paid' | transloco }}
          </th>
          <th scope="col" class="px-3 py-2 font-medium text-text-muted">
            {{ 'admin.col.periodEnd' | transloco }}
          </th>
          <th scope="col" class="px-3 py-2 font-medium text-text-muted">
            {{ 'admin.col.createdAt' | transloco }}
          </th>
          <th scope="col" class="px-3 py-2 font-medium text-text-muted">
            {{ 'admin.col.demo' | transloco }}
          </th>
          <th scope="col" class="px-3 py-2 font-medium text-text-muted">
            {{ 'admin.col.action' | transloco }}
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
                <app-admin-plan-badge [plan]="u.effectivePlan" />
              </td>
              <td class="px-3 py-2">
                <app-admin-status-badge [status]="u.status" />
              </td>
              <td class="px-3 py-2">
                <app-admin-source-badge [source]="u.source" />
              </td>
              <td class="px-3 py-2 tabular-nums">
                @if (u.paid) {
                  <span [attr.aria-label]="'admin.paid.yes' | transloco">✓</span>
                } @else {
                  <span class="text-text-muted" [attr.aria-label]="'admin.paid.no' | transloco"
                    >—</span
                  >
                }
              </td>
              <td class="px-3 py-2 tabular-nums text-text-muted">
                {{ u.currentPeriodEnd ? (u.currentPeriodEnd | date: 'shortDate') : '—' }}
              </td>
              <td class="px-3 py-2 tabular-nums text-text-muted">
                {{ u.createdAt | date: 'shortDate' }}
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
              <td class="px-3 py-2">
                <form class="flex items-center gap-2" (submit)="apply($event, u.id)">
                  <label class="sr-only" [attr.for]="'plan-' + u.id">
                    {{ 'admin.override.label' | transloco }}
                  </label>
                  <select
                    class="form-select"
                    [id]="'plan-' + u.id"
                    [attr.data-testid]="'admin-override-select-' + u.id"
                    [value]="u.effectivePlan"
                    [disabled]="overridingId() === u.id"
                  >
                    @for (option of planOptions; track option) {
                      <option [value]="option">{{ 'admin.plan.' + option | transloco }}</option>
                    }
                  </select>
                  <button
                    type="submit"
                    class="btn-submit min-h-11"
                    [attr.data-testid]="'admin-override-apply-' + u.id"
                    [disabled]="overridingId() === u.id"
                  >
                    {{
                      (overridingId() === u.id ? 'admin.override.applying' : 'admin.override.apply')
                        | transloco
                    }}
                  </button>
                </form>
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
  readonly overridingId = input<string | null>(null);

  readonly overridePlan = output<OverrideRequest>();
  readonly pageChange = output<number>();

  protected readonly planOptions = PLAN_OPTIONS;
  protected readonly columnCount = COLUMN_COUNT;
  protected readonly skeletonRows = Array.from({ length: 5 }, (_, i) => i);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize())),
  );

  protected apply(event: Event, userId: string): void {
    event.preventDefault();
    const select = (event.target as HTMLFormElement).querySelector('select');
    const planKey = select?.value as PlanKey | undefined;
    if (planKey) this.overridePlan.emit({ userId, planKey });
  }
}
