import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-budget-usage-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  host: { class: 'block' },
  template: `
    @if (totalIncome() > 0 && totalAllExpenses() > 0) {
      <section class="rounded-xl border border-border bg-surface p-4">
        <div class="flex items-center justify-between mb-2.5">
          <span class="text-xs font-medium text-text-muted">Budget utilisé</span>
          <span class="text-sm font-mono font-bold"
                [class.text-ib-green]="usagePercent() <= 80"
                [class.text-ib-orange]="usagePercent() > 80 && usagePercent() <= 100"
                [class.text-ib-red]="usagePercent() > 100">
            {{ usagePercent() | number:'1.0-0' }}%
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
          <span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-ib-red"></span> Passés {{ totalPassedExpenses() | number:'1.0-0' }}&euro;</span>
          <span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-ib-red/40"></span> A venir {{ totalUpcomingExpenses() | number:'1.0-0' }}&euro;</span>
          <span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-ib-orange"></span> Annuels ~{{ monthlyAnnualExpenses() | number:'1.0-0' }}&euro;/m</span>
          <span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-ib-yellow"></span> Dépenses {{ totalMonthSpendings() | number:'1.0-0' }}&euro;</span>
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
}
