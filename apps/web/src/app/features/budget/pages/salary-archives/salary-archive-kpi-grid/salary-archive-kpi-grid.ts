import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';
import { SalaryArchive } from '../../../domain/models/salary-archive.model';

@Component({
  selector: 'app-salary-archive-kpi-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, TranslocoPipe, Icon],
  host: { class: 'grid grid-cols-2 sm:grid-cols-4 gap-3' },
  template: `
    <div class="relative overflow-hidden rounded-xl border border-border bg-canvas p-4">
      <div class="flex items-center gap-1.5 mb-2">
        <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-green/10">
          <app-icon name="trending-up" size="12" class="text-ib-green" />
        </div>
        <p class="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          {{ 'budget.salaryArchive.kpi.salary' | transloco }}
        </p>
      </div>
      <p class="text-lg font-mono font-bold text-ib-green tracking-tight">
        {{ archive().salary | number: '1.2-2' }}<span class="text-xs ml-0.5">&euro;</span>
      </p>
    </div>
    <div class="relative overflow-hidden rounded-xl border border-border bg-canvas p-4">
      <div class="flex items-center gap-1.5 mb-2">
        <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-red/10">
          <app-icon name="receipt" size="12" class="text-ib-red" />
        </div>
        <p class="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          {{ 'budget.salaryArchive.kpi.fixedCharges' | transloco }}
        </p>
      </div>
      <p class="text-lg font-mono font-bold text-ib-red tracking-tight">
        {{ archive().totalExpenses | number: '1.2-2' }}<span class="text-xs ml-0.5">&euro;</span>
      </p>
    </div>
    <div class="relative overflow-hidden rounded-xl border border-border bg-canvas p-4">
      <div class="flex items-center gap-1.5 mb-2">
        <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-yellow/10">
          <app-icon name="banknote" size="12" class="text-ib-yellow" />
        </div>
        <p class="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          {{ 'budget.salaryArchive.kpi.spendings' | transloco }}
        </p>
      </div>
      <p class="text-lg font-mono font-bold text-ib-yellow tracking-tight">
        {{ archive().totalSpendings | number: '1.2-2' }}<span class="text-xs ml-0.5">&euro;</span>
      </p>
    </div>
    <div
      class="relative overflow-hidden rounded-xl border bg-canvas p-4"
      [class.border-ib-green-30]="remaining() >= 0"
      [class.border-ib-red-30]="remaining() < 0"
    >
      <div class="flex items-center gap-1.5 mb-2">
        <div
          class="flex h-6 w-6 items-center justify-center rounded-lg"
          [class.bg-ib-green-10]="remaining() >= 0"
          [class.bg-ib-red-10]="remaining() < 0"
        >
          <app-icon
            name="wallet"
            size="12"
            [class.text-ib-green]="remaining() >= 0"
            [class.text-ib-red]="remaining() < 0"
          />
        </div>
        <p class="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          {{ 'budget.salaryArchive.kpi.remaining' | transloco }}
        </p>
      </div>
      <p
        class="text-lg font-mono font-bold tracking-tight"
        [class.text-ib-green]="remaining() >= 0"
        [class.text-ib-red]="remaining() < 0"
      >
        {{ remaining() >= 0 ? '+' : '' }}{{ remaining() | number: '1.2-2'
        }}<span class="text-xs ml-0.5">&euro;</span>
      </p>
    </div>
  `,
})
export class SalaryArchiveKpiGrid {
  readonly archive = input.required<SalaryArchive>();
  readonly remaining = input.required<number>();
}
