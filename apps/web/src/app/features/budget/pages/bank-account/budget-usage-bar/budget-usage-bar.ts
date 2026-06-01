import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-budget-usage-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, TranslocoPipe],
  host: { class: 'block' },
  template: `
    @if (totalIncome() > 0 && totalAllExpenses() > 0) {
      <section class="rounded-xl border border-border bg-surface p-4">
        <div class="flex items-center justify-between mb-2.5">
          <span class="text-xs font-medium text-text-muted">{{ 'budget.bankAccount.usage.label' | transloco }}</span>
          <span class="inline-flex items-center gap-2">
            <span class="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  [class.bg-ib-green-10]="usageState() === 'ok'" [class.text-ib-green]="usageState() === 'ok'"
                  [class.bg-ib-orange-10]="usageState() === 'tight'" [class.text-ib-orange]="usageState() === 'tight'"
                  [class.bg-ib-red-10]="usageState() === 'over'" [class.text-ib-red]="usageState() === 'over'">
              @switch (usageState()) {
                @case ('ok') { {{ 'budget.bankAccount.usage.stateOk' | transloco }} }
                @case ('tight') { {{ 'budget.bankAccount.usage.stateTight' | transloco }} }
                @case ('over') { {{ 'budget.bankAccount.usage.stateOver' | transloco }} }
              }
            </span>
            <span class="text-sm font-mono font-bold"
                  [class.text-ib-green]="usageState() === 'ok'"
                  [class.text-ib-orange]="usageState() === 'tight'"
                  [class.text-ib-red]="usageState() === 'over'">
              {{ usagePercent() | number:'1.0-0' }}%
            </span>
          </span>
        </div>
        <div class="h-2.5 rounded-full bg-hover overflow-hidden">
          <div class="h-full rounded-full transition duration-500 ease-out"
               [style.width.%]="usagePercent() > 100 ? 100 : usagePercent()"
               [class.bg-ib-green]="usagePercent() <= 80"
               [class.bg-ib-orange]="usagePercent() > 80 && usagePercent() <= 100"
               [class.bg-ib-red]="usagePercent() > 100">
          </div>
        </div>
        <!-- Légende segmentée -->
        <div class="flex items-center gap-4 mt-2.5 text-[10px] text-text-muted">
          <span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-ib-red"></span> {{ 'budget.bankAccount.usage.passed' | transloco }} {{ totalPassedExpenses() | number:'1.0-0' }}&euro;</span>
          <span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-ib-red/40"></span> {{ 'budget.bankAccount.usage.upcoming' | transloco }} {{ totalUpcomingExpenses() | number:'1.0-0' }}&euro;</span>
          <span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-ib-orange"></span> {{ 'budget.bankAccount.usage.annual' | transloco }} {{ 'budget.dashboard.annualMonthlyApprox' | transloco: { value: (monthlyAnnualExpenses() | number:'1.0-0') } }}</span>
          <span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-ib-yellow"></span> {{ 'budget.bankAccount.usage.spendings' | transloco }} {{ totalMonthSpendings() | number:'1.0-0' }}&euro;</span>
        </div>
      </section>
    }
  `,
})
export class BudgetUsageBar {
  readonly totalIncome = input.required<number>();
  readonly totalAllExpenses = input.required<number>();
  readonly usagePercent = input.required<number>();
  readonly totalPassedExpenses = input.required<number>();
  readonly totalUpcomingExpenses = input.required<number>();
  readonly monthlyAnnualExpenses = input.required<number>();
  readonly totalMonthSpendings = input.required<number>();

  protected readonly usageState = computed<'ok' | 'tight' | 'over'>(() => {
    const p = this.usagePercent();
    return p <= 80 ? 'ok' : p <= 100 ? 'tight' : 'over';
  });
}
