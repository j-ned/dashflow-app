import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, skip } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { AdminStore } from '@core/admin/admin.store';
import { AdminUsersTable } from './admin-users-table';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 250;

@Component({
  selector: 'app-admin-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full h-full overflow-y-auto' },
  imports: [TranslocoPipe, AdminUsersTable],
  template: `
    <section aria-labelledby="admin-title" class="mx-auto max-w-6xl p-6 pb-12">
      <header class="mb-8">
        <p class="font-mono text-xs uppercase tracking-[0.18em] text-text-muted">
          {{ 'admin.eyebrow' | transloco }}
        </p>
        <h1 id="admin-title" class="mt-1 text-2xl font-semibold tracking-tight text-text-primary">
          {{ 'admin.title' | transloco }}
        </h1>
      </header>

      <dl class="mb-8 flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-border bg-surface p-4">
        <div class="flex flex-col">
          <dt class="font-mono text-xs uppercase tracking-[0.18em] text-text-muted">
            {{ 'admin.metrics.totalUsers' | transloco }}
          </dt>
          <dd
            class="text-lg font-semibold text-text-primary tabular-nums"
            data-testid="metric-total"
          >
            {{ store.total() }}
          </dd>
        </div>
      </dl>

      <div class="mb-4">
        <label class="sr-only" for="admin-search">{{ 'admin.search.label' | transloco }}</label>
        <input
          id="admin-search"
          type="search"
          class="form-input max-w-sm"
          data-testid="admin-search"
          [value]="search()"
          (input)="search.set($any($event.target).value)"
          [attr.placeholder]="'admin.search.placeholder' | transloco"
        />
      </div>

      <app-admin-users-table
        [users]="store.users()"
        [total]="store.total()"
        [page]="page()"
        [pageSize]="pageSize"
        [loading]="store.loading()"
        (pageChange)="goToPage($event)"
      />
    </section>
  `,
})
export class AdminPage {
  protected readonly store = inject(AdminStore);

  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = PAGE_SIZE;

  constructor() {
    void this.store.loadUsers({ page: 1, pageSize: PAGE_SIZE });

    toObservable(this.search)
      .pipe(skip(1), debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((query) => {
        this.page.set(1);
        void this.store.loadUsers({ search: query, page: 1, pageSize: PAGE_SIZE });
      });
  }

  protected goToPage(page: number): void {
    this.page.set(page);
    void this.store.loadUsers({
      search: this.search() || undefined,
      page,
      pageSize: PAGE_SIZE,
    });
  }
}
