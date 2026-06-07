import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * "Ce qui compose le mois" : la décomposition revenus / charges (les 4 anciens KPI)
 * réunie avec la barre d'usage du budget en un seul bloc lisible.
 */
@Component({
  selector: 'app-budget-usage-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, TranslocoPipe],
  host: { class: 'block' },
  template: `
    @if (totalIncome() > 0 && totalAllExpenses() > 0) {
      <section class="rounded-lg border border-border bg-surface p-4">
        <div class="mb-3 flex items-center justify-between">
          <span class="text-sm font-semibold text-text-primary">{{
            'budget.bankAccount.usage.compose' | transloco
          }}</span>
          <span class="inline-flex items-center gap-2">
            <span
              class="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              [class.bg-ib-green-10]="usageState() === 'ok'"
              [class.text-ib-green]="usageState() === 'ok'"
              [class.bg-ib-orange-10]="usageState() === 'tight'"
              [class.text-ib-orange]="usageState() === 'tight'"
              [class.bg-ib-red-10]="usageState() === 'over'"
              [class.text-ib-red]="usageState() === 'over'"
            >
              @switch (usageState()) {
                @case ('ok') {
                  {{ 'budget.bankAccount.usage.stateOk' | transloco }}
                }
                @case ('tight') {
                  {{ 'budget.bankAccount.usage.stateTight' | transloco }}
                }
                @case ('over') {
                  {{ 'budget.bankAccount.usage.stateOver' | transloco }}
                }
              }
            </span>
            <span
              class="font-mono text-sm font-bold"
              [class.text-ib-green]="usageState() === 'ok'"
              [class.text-ib-orange]="usageState() === 'tight'"
              [class.text-ib-red]="usageState() === 'over'"
            >
              {{ usagePercent() | number: '1.0-0' }}%
            </span>
          </span>
        </div>

        <!-- Décomposition : revenus puis les 3 types de charges -->
        <div class="mb-3 flex flex-wrap items-baseline gap-x-5 gap-y-1.5 text-sm">
          <span class="inline-flex items-baseline gap-1.5">
            <span class="h-2 w-2 self-center rounded-full bg-ib-green" aria-hidden="true"></span>
            <span class="text-xs text-text-muted">{{
              'budget.bankAccount.kpi.income' | transloco
            }}</span>
            <span class="font-mono font-semibold text-ib-green"
              >+{{ totalIncome() | number: '1.0-0' }}&euro;</span
            >
          </span>
          <span
            class="hidden h-3.5 w-px self-center bg-border sm:inline-block"
            aria-hidden="true"
          ></span>
          <span class="inline-flex items-baseline gap-1.5">
            <span class="h-2 w-2 self-center rounded-full bg-ib-red" aria-hidden="true"></span>
            <span class="text-xs text-text-muted">{{
              'budget.bankAccount.kpi.directDebits' | transloco
            }}</span>
            <span class="font-mono font-semibold text-text-primary"
              >&minus;{{ totalMonthlyExpenses() | number: '1.0-0' }}&euro;</span
            >
          </span>
          <span class="inline-flex items-baseline gap-1.5">
            <span class="h-2 w-2 self-center rounded-full bg-ib-orange" aria-hidden="true"></span>
            <span class="text-xs text-text-muted">{{
              'budget.bankAccount.kpi.annual' | transloco
            }}</span>
            <span class="font-mono font-semibold text-text-primary"
              >&minus;{{ monthlyAnnualExpenses() | number: '1.0-0' }}&euro;<span
                class="text-text-muted"
                >/m</span
              ></span
            >
          </span>
          <span class="inline-flex items-baseline gap-1.5">
            <span class="h-2 w-2 self-center rounded-full bg-ib-yellow" aria-hidden="true"></span>
            <span class="text-xs text-text-muted">{{
              'budget.bankAccount.kpi.spending' | transloco
            }}</span>
            <span class="font-mono font-semibold text-text-primary"
              >&minus;{{ totalMonthSpendings() | number: '1.0-0' }}&euro;</span
            >
          </span>
        </div>

        <div class="h-2.5 overflow-hidden rounded-full bg-hover">
          <div
            class="h-full rounded-full transition duration-500 ease-out"
            [style.width.%]="usageWidth()"
            [class.bg-ib-green]="usageState() === 'ok'"
            [class.bg-ib-orange]="usageState() === 'tight'"
            [class.bg-ib-red]="usageState() === 'over'"
          ></div>
        </div>
        <p class="mt-2 text-[11px] text-text-muted">
          {{
            'budget.bankAccount.usage.hint'
              | transloco: { percent: (usagePercent() | number: '1.0-0') }
          }}
        </p>
      </section>
    }
  `,
})
export class BudgetUsageBar {
  readonly totalIncome = input.required<number>();
  readonly totalAllExpenses = input.required<number>();
  readonly usagePercent = input.required<number>();
  readonly totalMonthlyExpenses = input.required<number>();
  readonly monthlyAnnualExpenses = input.required<number>();
  readonly totalMonthSpendings = input.required<number>();

  protected readonly usageState = computed<'ok' | 'tight' | 'over'>(() => {
    const p = this.usagePercent();
    return p <= 80 ? 'ok' : p <= 100 ? 'tight' : 'over';
  });

  protected readonly usageWidth = computed(() => Math.min(100, this.usagePercent()));
}
