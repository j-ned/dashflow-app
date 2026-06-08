import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';
import { MemberSummary } from '../../../domain/member-summary';

@Component({
  selector: 'app-member-kpi-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, TranslocoPipe, Icon],
  host: { class: 'grid grid-cols-2 sm:grid-cols-3 gap-3' },
  template: `
    @if (summary().incomes.length > 0) {
      <div
        class="group relative overflow-hidden rounded-xl border border-border bg-surface p-4 transition hover:border-ib-green/30 hover:shadow-lg hover:shadow-ib-green/5"
      >
        <div class="flex items-center gap-1.5 mb-2">
          <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-green/10">
            <app-icon name="trending-up" size="12" class="text-ib-green" />
          </div>
          <p class="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            {{ 'budget.dashboard.kpi.income' | transloco }}
          </p>
        </div>
        <p class="text-lg font-mono font-bold text-ib-green tracking-tight">
          {{ summary().totalIncome | number: '1.2-2' }}<span class="text-xs ml-0.5">&euro;</span>
        </p>
      </div>
    }
    @if (
      summary().totalMonthlyExpenses + summary().monthlyAnnualExpenses + summary().totalSpendings >
      0
    ) {
      <div
        class="group relative overflow-hidden rounded-xl border border-border bg-surface p-4 transition hover:border-ib-orange/30 hover:shadow-lg hover:shadow-ib-orange/5"
      >
        <div class="flex items-center gap-1.5 mb-2">
          <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-orange/10">
            <app-icon name="receipt" size="12" class="text-ib-orange" />
          </div>
          <p class="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            {{ 'budget.dashboard.kpi.monthlyCharges' | transloco }}
          </p>
        </div>
        <p class="text-lg font-mono font-bold text-ib-orange tracking-tight">
          {{
            summary().totalMonthlyExpenses +
              summary().monthlyAnnualExpenses +
              summary().totalSpendings | number: '1.2-2'
          }}<span class="text-xs ml-0.5">&euro;</span>
        </p>
      </div>
    }
    @if (summary().incomes.length > 0) {
      <div
        class="group relative overflow-hidden rounded-xl border bg-surface p-4 transition"
        [class.border-ib-green-40]="summary().remaining >= 0"
        [class.border-ib-red-40]="summary().remaining < 0"
        [class.hover:shadow-lg]="true"
        [class.hover:shadow-ib-green-5]="summary().remaining >= 0"
        [class.hover:shadow-ib-red-5]="summary().remaining < 0"
      >
        <div class="flex items-center gap-1.5 mb-2">
          <div
            class="flex h-6 w-6 items-center justify-center rounded-lg"
            [class.bg-ib-green-10]="summary().remaining >= 0"
            [class.bg-ib-red-10]="summary().remaining < 0"
          >
            <app-icon
              name="wallet"
              size="12"
              [class.text-ib-green]="summary().remaining >= 0"
              [class.text-ib-red]="summary().remaining < 0"
            />
          </div>
          <p class="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            {{ 'budget.dashboard.kpi.remaining' | transloco }}
          </p>
        </div>
        <p
          class="text-lg font-mono font-bold tracking-tight"
          [class.text-ib-green]="summary().remaining >= 0"
          [class.text-ib-red]="summary().remaining < 0"
        >
          {{ summary().remaining | number: '1.2-2' }}<span class="text-xs ml-0.5">&euro;</span>
        </p>
      </div>
    }
  `,
})
export class MemberKpiGrid {
  readonly summary = input.required<MemberSummary>();
}
