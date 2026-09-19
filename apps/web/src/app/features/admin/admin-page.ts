import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, skip } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AdminStore } from '@core/admin/admin.store';
import { NOTICE_REASONS, isEligibleFor, type NoticeReason } from '@core/admin/admin.types';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { Toaster } from '@shared/components/toast/toast';
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

      <dl
        class="mb-8 flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-border bg-surface p-4"
      >
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

      <section
        aria-labelledby="admin-notices-title"
        class="mb-8 rounded-lg border border-border bg-surface p-4"
        data-testid="admin-notices"
      >
        <h2 id="admin-notices-title" class="text-sm font-semibold text-text-primary">
          {{ 'admin.notices.title' | transloco }}
        </h2>
        <p class="mt-1 max-w-3xl text-xs text-text-muted">
          {{ 'admin.notices.help' | transloco }}
        </p>

        <div class="mt-4 flex flex-wrap items-end gap-3">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-text-muted" for="admin-notice-reason">
              {{ 'admin.notices.reasonLabel' | transloco }}
            </label>
            <select
              id="admin-notice-reason"
              class="form-input min-w-64"
              data-testid="admin-notice-reason"
              [value]="reason()"
              (change)="setReason($any($event.target).value)"
            >
              @for (r of reasons; track r) {
                <option [value]="r">
                  {{ 'admin.notices.reason.' + r | transloco }} ({{ eligibleCount(r) }})
                </option>
              }
            </select>
          </div>

          <button
            type="button"
            class="btn-cancel min-h-11 border! border-border! disabled:opacity-50"
            data-testid="admin-send-selected"
            [disabled]="selectedForReason().length === 0 || store.sending()"
            (click)="send('selected')"
          >
            {{ 'admin.notices.sendSelected' | transloco: { count: selectedForReason().length } }}
          </button>
          <button
            type="button"
            class="btn-submit min-h-11 bg-ib-blue"
            data-testid="admin-send-all"
            [disabled]="sendableToAll() === 0 || store.sending()"
            (click)="send('all')"
          >
            {{ 'admin.notices.sendAll' | transloco: { count: sendableToAll() } }}
          </button>
        </div>

        <p class="mt-3 text-xs text-text-muted" data-testid="admin-notice-effect">
          {{ 'admin.notices.effect.' + reason() | transloco }}
          @if (onCooldown() > 0) {
            {{ 'admin.notices.cooldown' | transloco: { count: onCooldown() } }}
          }
        </p>
      </section>

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
        [selectedIds]="selected()"
        (toggleSelect)="toggleSelect($event)"
        (pageChange)="goToPage($event)"
      />
    </section>
  `,
})
export class AdminPage {
  protected readonly store = inject(AdminStore);
  private readonly confirm = inject(ConfirmService);
  private readonly toaster = inject(Toaster);
  private readonly i18n = inject(TranslocoService);

  protected readonly reasons = NOTICE_REASONS;
  protected readonly reason = signal<NoticeReason>('reconnect');
  protected readonly selected = signal<ReadonlySet<string>>(new Set());

  /** Parmi les comptes cochés, ceux que le motif choisi concerne vraiment (les autres seraient refusés). */
  protected readonly selectedForReason = computed(() =>
    this.store
      .users()
      .filter((u) => this.selected().has(u.id) && isEligibleFor(u, this.reason()))
      .map((u) => u.id),
  );
  protected readonly onCooldown = computed(
    () => this.store.summary()?.[this.reason()]?.onCooldown ?? 0,
  );
  protected readonly sendableToAll = computed(() => {
    const counts = this.store.summary()?.[this.reason()];
    return counts ? counts.eligible - counts.onCooldown : 0;
  });

  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = PAGE_SIZE;

  constructor() {
    void this.store.loadUsers({ page: 1, pageSize: PAGE_SIZE });
    void this.store.loadSummary();

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

  protected eligibleCount(reason: NoticeReason): number {
    return this.store.summary()?.[reason]?.eligible ?? 0;
  }

  protected setReason(value: string): void {
    if ((NOTICE_REASONS as readonly string[]).includes(value))
      this.reason.set(value as NoticeReason);
  }

  protected toggleSelect(id: string): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  protected async send(scope: 'selected' | 'all'): Promise<void> {
    const reason = this.reason();
    const userIds = scope === 'selected' ? this.selectedForReason() : undefined;
    const count = userIds ? userIds.length : this.sendableToAll();
    if (count === 0) return;

    const label = this.i18n.translate('admin.notices.reason.' + reason);
    const confirmed = await this.confirm.confirm({
      title: this.i18n.translate('admin.notices.confirm.title'),
      message:
        this.i18n.translate('admin.notices.confirm.message', { count, reason: label }) +
        ' ' +
        this.i18n.translate('admin.notices.effect.' + reason),
      confirmLabel: this.i18n.translate('admin.notices.confirm.action'),
    });
    if (!confirmed) return;

    const result = await this.store.sendNotices(reason, userIds);
    if (!result) return;

    const skipped = result.skipped.length;
    if (result.sent.length === 0) {
      this.toaster.info('admin.notices.toast.noneSent', { skipped });
    } else if (skipped > 0) {
      this.toaster.success('admin.notices.toast.sentWithSkipped', {
        sent: result.sent.length,
        skipped,
      });
    } else {
      this.toaster.success('admin.notices.toast.sent', { sent: result.sent.length });
    }
    this.selected.set(new Set());
    void this.store.loadSummary();
    this.goToPage(this.page());
  }
}
