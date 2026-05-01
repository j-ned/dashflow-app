import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Icon } from '@shared/components/icon/icon';

@Component({
  selector: 'app-bank-kpi-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, Icon],
  host: { class: 'block' },
  template: `
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
      <!-- Solde actuel -->
      <div class="group relative overflow-hidden rounded-xl border bg-surface p-5 transition"
           [class.border-ib-cyan-40]="currentBalance() >= 0"
           [class.border-ib-red-40]="currentBalance() < 0"
           [class.hover:shadow-lg]="true"
           [class.hover:shadow-ib-cyan-5]="currentBalance() >= 0"
           [class.hover:shadow-ib-red-5]="currentBalance() < 0">
        <div class="flex items-center gap-2 mb-3">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg"
               [class.bg-ib-cyan-10]="currentBalance() >= 0"
               [class.bg-ib-red-10]="currentBalance() < 0">
            <app-icon name="wallet" size="14"
                      [class.text-ib-cyan]="currentBalance() >= 0"
                      [class.text-ib-red]="currentBalance() < 0" />
          </div>
          <p class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Solde actuel</p>
        </div>
        <p class="text-2xl font-mono font-bold tracking-tight"
           [class.text-ib-cyan]="currentBalance() >= 0"
           [class.text-ib-red]="currentBalance() < 0">
          {{ currentBalance() | number:'1.2-2' }}<span class="text-base ml-0.5">&euro;</span>
        </p>
        <p class="mt-1.5 text-[11px] text-text-muted">au {{ today() }}</p>
      </div>

      <!-- Revenus -->
      <div class="group relative overflow-hidden rounded-xl border border-border bg-surface p-5 transition hover:border-ib-green/30 hover:shadow-lg hover:shadow-ib-green/5">
        <div class="flex items-center gap-2 mb-3">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-ib-green/10">
            <app-icon name="trending-up" size="14" class="text-ib-green" />
          </div>
          <p class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Revenus</p>
        </div>
        <p class="text-2xl font-mono font-bold text-ib-green tracking-tight">{{ totalIncome() | number:'1.2-2' }}<span class="text-base ml-0.5">&euro;</span></p>
        <p class="mt-1.5 text-[11px] text-text-muted truncate">{{ incomesLabel() }}</p>
      </div>

      <!-- Prélèvements mensuels -->
      <div class="group relative overflow-hidden rounded-xl border border-border bg-surface p-5 transition hover:border-ib-red/30 hover:shadow-lg hover:shadow-ib-red/5">
        <div class="flex items-center gap-2 mb-3">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-ib-red/10">
            <app-icon name="receipt" size="14" class="text-ib-red" />
          </div>
          <p class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Prélèvements</p>
        </div>
        <p class="text-2xl font-mono font-bold text-ib-red tracking-tight">{{ totalMonthlyExpenses() | number:'1.2-2' }}<span class="text-base ml-0.5">&euro;</span></p>
        <p class="mt-1.5 text-[11px] text-text-muted">{{ monthlyExpensesLabel() }}</p>
      </div>

      <!-- Prélèvements annuels -->
      <div class="group relative overflow-hidden rounded-xl border border-border bg-surface p-5 transition hover:border-ib-orange/30 hover:shadow-lg hover:shadow-ib-orange/5">
        <div class="flex items-center gap-2 mb-3">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-ib-orange/10">
            <app-icon name="calendar" size="14" class="text-ib-orange" />
          </div>
          <p class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Annuels</p>
        </div>
        <p class="text-2xl font-mono font-bold text-ib-orange tracking-tight">{{ totalAnnualExpenses() | number:'1.2-2' }}<span class="text-base ml-0.5">&euro;/an</span></p>
        <p class="mt-1.5 text-[11px] text-text-muted">soit ~{{ monthlyAnnualExpenses() | number:'1.2-2' }}&euro;/mois</p>
      </div>

      <!-- Dépenses du mois -->
      <div class="group relative overflow-hidden rounded-xl border border-border bg-surface p-5 transition hover:border-ib-yellow/30 hover:shadow-lg hover:shadow-ib-yellow/5">
        <div class="flex items-center gap-2 mb-3">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-ib-yellow/10">
            <app-icon name="banknote" size="14" class="text-ib-yellow" />
          </div>
          <p class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Dépenses</p>
        </div>
        <p class="text-2xl font-mono font-bold text-ib-yellow tracking-tight">{{ totalMonthSpendings() | number:'1.2-2' }}<span class="text-base ml-0.5">&euro;</span></p>
        <p class="mt-1.5 text-[11px] text-text-muted">{{ monthSpendingsLabel() }}</p>
      </div>

      <!-- Solde fin de mois -->
      <div class="group relative overflow-hidden rounded-xl border bg-surface p-5 transition"
           [class.border-ib-green-40]="endOfMonthBalance() >= 0"
           [class.border-ib-red-40]="endOfMonthBalance() < 0"
           [class.hover:shadow-lg]="true"
           [class.hover:shadow-ib-green-5]="endOfMonthBalance() >= 0"
           [class.hover:shadow-ib-red-5]="endOfMonthBalance() < 0">
        <div class="flex items-center gap-2 mb-3">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg"
               [class.bg-ib-green-10]="endOfMonthBalance() >= 0"
               [class.bg-ib-red-10]="endOfMonthBalance() < 0">
            <app-icon name="calendar" size="14"
                      [class.text-ib-green]="endOfMonthBalance() >= 0"
                      [class.text-ib-red]="endOfMonthBalance() < 0" />
          </div>
          <p class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Solde fin de cycle</p>
        </div>
        <p class="text-2xl font-mono font-bold tracking-tight"
           [class.text-ib-green]="endOfMonthBalance() >= 0"
           [class.text-ib-red]="endOfMonthBalance() < 0">
          {{ endOfMonthBalance() | number:'1.2-2' }}<span class="text-base ml-0.5">&euro;</span>
        </p>
        <p class="mt-1.5 text-[11px] text-text-muted">après toutes charges du cycle</p>
      </div>
    </section>
  `,
})
export class BankKpiGrid {
  readonly currentBalance = input.required<number>();
  readonly totalIncome = input.required<number>();
  readonly totalMonthlyExpenses = input.required<number>();
  readonly totalAnnualExpenses = input.required<number>();
  readonly monthlyAnnualExpenses = input.required<number>();
  readonly totalMonthSpendings = input.required<number>();
  readonly endOfMonthBalance = input.required<number>();
  readonly today = input.required<string>();
  readonly incomesLabel = input.required<string>();
  readonly monthlyExpensesLabel = input.required<string>();
  readonly monthSpendingsLabel = input.required<string>();
}
