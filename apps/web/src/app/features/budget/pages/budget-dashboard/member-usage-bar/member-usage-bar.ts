import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { MemberSummary } from '../../../domain/member-summary';

@Component({
  selector: 'app-member-usage-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, TranslocoPipe],
  host: { class: 'block rounded-xl border border-border bg-surface p-3' },
  template: `
    @let allCharges =
      summary().totalMonthlyExpenses + summary().monthlyAnnualExpenses + summary().totalSpendings;
    @let pctBudget = (allCharges / summary().totalIncome) * 100;
    <div class="flex items-center justify-between mb-2">
      <span class="text-[11px] font-medium text-text-muted">{{
        'budget.dashboard.usage.label' | transloco
      }}</span>
      <span class="inline-flex items-center gap-2">
        <span
          class="rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
          [class.bg-ib-green-10]="pctBudget <= 80"
          [class.text-ib-green]="pctBudget <= 80"
          [class.bg-ib-orange-10]="pctBudget > 80 && pctBudget <= 100"
          [class.text-ib-orange]="pctBudget > 80 && pctBudget <= 100"
          [class.bg-ib-red-10]="pctBudget > 100"
          [class.text-ib-red]="pctBudget > 100"
        >
          @if (pctBudget <= 80) {
            {{ 'budget.dashboard.usage.stateOk' | transloco }}
          } @else if (pctBudget <= 100) {
            {{ 'budget.dashboard.usage.stateTight' | transloco }}
          } @else {
            {{ 'budget.dashboard.usage.stateOver' | transloco }}
          }
        </span>
        <span
          class="text-sm font-mono font-bold"
          [class.text-ib-green]="pctBudget <= 80"
          [class.text-ib-orange]="pctBudget > 80 && pctBudget <= 100"
          [class.text-ib-red]="pctBudget > 100"
        >
          {{ pctBudget | number: '1.0-0' }}%
        </span>
      </span>
    </div>
    <div class="h-2.5 rounded-full bg-hover overflow-hidden">
      <div
        class="h-full rounded-full transition duration-500 ease-out"
        [style.width.%]="pctBudget > 100 ? 100 : pctBudget"
        [class.bg-ib-green]="pctBudget <= 80"
        [class.bg-ib-orange]="pctBudget > 80 && pctBudget <= 100"
        [class.bg-ib-red]="pctBudget > 100"
      ></div>
    </div>
    <div class="flex items-center gap-4 mt-2 text-[10px] text-text-muted">
      <span class="flex items-center gap-1"
        ><span class="h-2 w-2 rounded-full bg-ib-red"></span>
        {{ 'budget.dashboard.usage.monthly' | transloco }}
        {{ summary().totalMonthlyExpenses | number: '1.0-0' }}&euro;</span
      >
      <span class="flex items-center gap-1"
        ><span class="h-2 w-2 rounded-full bg-ib-orange"></span>
        {{ 'budget.dashboard.usage.annual' | transloco }}
        {{
          'budget.dashboard.annualMonthlyApprox'
            | transloco: { value: (summary().monthlyAnnualExpenses | number: '1.0-0') }
        }}</span
      >
      <span class="flex items-center gap-1"
        ><span class="h-2 w-2 rounded-full bg-ib-yellow"></span>
        {{ 'budget.dashboard.usage.spendings' | transloco }}
        {{ summary().totalSpendings | number: '1.0-0' }}&euro;</span
      >
    </div>
  `,
})
export class MemberUsageBar {
  readonly summary = input.required<MemberSummary>();
}
