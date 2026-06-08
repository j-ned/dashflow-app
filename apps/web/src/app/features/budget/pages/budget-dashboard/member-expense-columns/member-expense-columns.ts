import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';
import { MemberSummary } from '../../../domain/member-summary';

@Component({
  selector: 'app-member-expense-columns',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, RouterLink, TranslocoPipe, Icon],
  host: { class: 'grid grid-cols-1 lg:grid-cols-3 gap-3 items-start' },
  template: `
    @if (summary().monthlyExpenses.length > 0) {
      <a
        data-dash-ref
        routerLink="/budget/account"
        class="rounded-xl border border-border bg-surface overflow-hidden hover:border-ib-red/30 transition hover:shadow-lg hover:shadow-ib-red/5"
      >
        <div class="flex items-center gap-2 px-4 py-2.5 bg-ib-red/5 border-b border-border/50">
          <app-icon name="receipt" size="13" class="text-ib-red" />
          <span class="text-[11px] font-semibold uppercase tracking-wider text-ib-red">{{
            'budget.dashboard.monthly' | transloco
          }}</span>
          <span class="ml-auto text-sm font-mono font-bold text-ib-red"
            >{{ summary().totalMonthlyExpenses | number: '1.2-2' }}&euro;</span
          >
        </div>
        <div class="divide-y divide-border/20 px-3 py-1">
          @for (entry of summary().monthlyExpenses; track entry.id) {
            @let passed = summary().isExpensePassed(entry);
            <div class="flex items-center justify-between py-1.5" [class.opacity-50]="passed">
              <div class="flex items-center gap-2 min-w-0">
                <div
                  class="flex h-6 w-6 items-center justify-center rounded-lg text-[9px] font-bold shrink-0"
                  [class.bg-ib-red-10]="!passed"
                  [class.text-ib-red]="!passed"
                  [class.bg-ib-green-10]="passed"
                  [class.text-ib-green]="passed"
                >
                  @if (passed) {
                    <app-icon name="check" size="14" />
                  } @else if (entry.dayOfMonth) {
                    {{ entry.dayOfMonth }}
                  } @else {
                    —
                  }
                </div>
                <span
                  class="text-[13px] text-text-primary truncate"
                  [class.line-through]="passed"
                  >{{ entry.label }}</span
                >
              </div>
              <span class="text-[13px] font-mono font-medium text-text-muted shrink-0 ml-2"
                >{{ entry.amount | number: '1.2-2' }}&euro;</span
              >
            </div>
          }
        </div>
      </a>
    }

    @if (summary().annualExpenses.length > 0) {
      <a
        routerLink="/budget/account"
        class="flex flex-col rounded-xl border border-border bg-surface overflow-hidden hover:border-ib-orange/30 transition hover:shadow-lg hover:shadow-ib-orange/5"
        [style.max-height.px]="dashRefCardHeight()"
      >
        <div
          class="flex items-center gap-2 px-4 py-2.5 bg-ib-orange/5 border-b border-border/50 shrink-0"
        >
          <app-icon name="calendar" size="13" class="text-ib-orange" />
          <span class="text-[11px] font-semibold uppercase tracking-wider text-ib-orange">{{
            'budget.dashboard.annual' | transloco
          }}</span>
          <span class="ml-auto text-sm font-mono font-bold text-ib-orange"
            >{{ summary().totalAnnualExpenses | number: '1.2-2'
            }}{{ 'budget.bankAccount.expenses.annualSuffix' | transloco }}</span
          >
        </div>
        <div class="divide-y divide-border/20 px-3 py-1 overflow-y-auto flex-1">
          @for (entry of summary().annualExpenses; track entry.id) {
            <div class="flex items-center justify-between py-1.5">
              <span class="text-[13px] text-text-primary truncate">{{ entry.label }}</span>
              <div class="flex items-center gap-1 shrink-0 ml-2">
                <span class="text-[13px] font-mono font-medium text-text-muted"
                  >{{ entry.amount | number: '1.2-2' }}&euro;</span
                >
                <span class="text-[10px] text-text-muted">{{
                  'budget.dashboard.annualMonthlyApprox'
                    | transloco: { value: (entry.amount / 12 | number: '1.0-0') }
                }}</span>
              </div>
            </div>
          }
        </div>
      </a>
    }

    @if (summary().spendings.length > 0) {
      <a
        routerLink="/budget/account"
        class="flex flex-col rounded-xl border border-border bg-surface overflow-hidden hover:border-ib-yellow/30 transition hover:shadow-lg hover:shadow-ib-yellow/5"
        [style.max-height.px]="dashRefCardHeight()"
      >
        <div
          class="flex items-center gap-2 px-4 py-2.5 bg-ib-yellow/5 border-b border-border/50 shrink-0"
        >
          <app-icon name="banknote" size="13" class="text-ib-yellow" />
          <span class="text-[11px] font-semibold uppercase tracking-wider text-ib-yellow">{{
            'budget.dashboard.spendings' | transloco
          }}</span>
          <span class="ml-auto text-sm font-mono font-bold text-ib-yellow"
            >{{ summary().totalSpendings | number: '1.2-2' }}&euro;</span
          >
        </div>
        <div class="divide-y divide-border/20 px-3 py-1 overflow-y-auto flex-1">
          @for (entry of summary().spendings; track entry.id) {
            <div class="flex items-center justify-between py-1.5">
              <div class="flex items-center gap-2 min-w-0">
                @if (entry.category) {
                  <span class="text-[10px] text-text-muted">{{ entry.category }}</span>
                }
                <span class="text-[13px] text-text-primary truncate">{{ entry.label }}</span>
              </div>
              <span class="text-[13px] font-mono font-medium text-text-muted shrink-0 ml-2"
                >{{ entry.amount | number: '1.2-2' }}&euro;</span
              >
            </div>
          }
        </div>
      </a>
    }
  `,
})
export class MemberExpenseColumns {
  readonly summary = input.required<MemberSummary>();
  readonly dashRefCardHeight = input.required<number | null>();
}
