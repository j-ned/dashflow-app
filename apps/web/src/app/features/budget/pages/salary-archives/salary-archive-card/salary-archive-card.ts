import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';
import { SalaryArchive } from '../../../domain/models/salary-archive.model';
import { SalaryArchiveKpiGrid } from '../salary-archive-kpi-grid/salary-archive-kpi-grid';

@Component({
  selector: 'app-salary-archive-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, DatePipe, TranslocoPipe, Icon, SalaryArchiveKpiGrid],
  host: { class: 'contents' },
  template: `
    <article
      class="group rounded-xl border border-border bg-surface overflow-hidden transition hover:shadow-lg hover:shadow-ib-cyan/5"
    >
      <button
        type="button"
        class="w-full flex items-center justify-between px-5 py-4 hover:bg-hover/30 transition-colors"
        (click)="toggled.emit()"
      >
        <div class="flex items-center gap-4">
          <div
            class="flex h-11 w-11 items-center justify-center rounded-xl bg-ib-cyan/10 text-ib-cyan"
          >
            <app-icon name="folder" size="20" />
          </div>
          <div class="text-left">
            <p class="text-base font-semibold text-text-primary">
              {{ monthLabel() }}
            </p>
            @if (accountName(); as aName) {
              <span class="text-[11px] text-ib-cyan/60">{{ aName }}</span>
            }
          </div>
        </div>
        <div class="flex items-center gap-6">
          <div class="text-right">
            <p class="text-lg font-mono font-bold text-ib-green">
              {{ archive().salary | number: '1.2-2' }}<span class="text-sm ml-0.5">&euro;</span>
            </p>
            <p class="text-[11px] text-text-muted">
              {{
                'budget.salaryArchive.expensesLabel'
                  | transloco
                    : {
                        value:
                          (+archive().totalExpenses + +archive().totalSpendings | number: '1.2-2'),
                      }
              }}
            </p>
          </div>
          <div
            class="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
            [class.bg-ib-cyan-10]="expanded()"
            [class.text-ib-cyan]="expanded()"
            [class.text-text-muted]="!expanded()"
          >
            <app-icon [name]="expanded() ? 'chevron-up' : 'chevron-down'" size="16" />
          </div>
        </div>
      </button>

      @if (expanded()) {
        <div class="border-t border-border px-5 py-5 space-y-4">
          <app-salary-archive-kpi-grid [archive]="archive()" [remaining]="remaining()" />

          @if (archive().spendings.length > 0) {
            <div class="rounded-xl border border-border overflow-hidden">
              <div
                class="flex items-center gap-2 px-4 py-2.5 bg-ib-yellow/5 border-b border-border/50"
              >
                <app-icon name="banknote" size="13" class="text-ib-yellow" />
                <span class="text-[11px] font-semibold uppercase tracking-wider text-ib-yellow">{{
                  'budget.salaryArchive.spendingsDetail' | transloco
                }}</span>
              </div>
              <div class="divide-y divide-border/20">
                @for (s of archive().spendings; track $index) {
                  <div class="flex items-center justify-between px-4 py-2.5">
                    <div class="flex items-center gap-2 min-w-0">
                      @if (s.date) {
                        <span class="text-[10px] font-mono text-text-muted">{{
                          s.date | date: 'dd/MM'
                        }}</span>
                      }
                      <span class="text-sm text-text-primary truncate">{{ s.label }}</span>
                      @if (s.category) {
                        <span
                          class="inline-flex items-center rounded-md bg-raised px-1.5 py-0.5 text-[10px] font-medium text-text-muted"
                          >{{ s.category }}</span
                        >
                      }
                    </div>
                    <span class="text-sm font-mono font-bold text-ib-yellow shrink-0"
                      >-{{ s.amount | number: '1.2-2' }}&euro;</span
                    >
                  </div>
                }
              </div>
            </div>
          }

          <div class="flex items-center justify-between pt-2">
            @if (archive().payslipKey) {
              <button
                type="button"
                (click)="openPayslip.emit()"
                class="inline-flex items-center gap-1.5 rounded-lg bg-ib-cyan/10 min-h-8 px-3 py-1.5 text-xs font-medium text-ib-cyan hover:bg-ib-cyan/20 transition-colors"
              >
                <app-icon name="file-text" size="14" />
                {{ 'budget.salaryArchive.viewPayslip' | transloco }}
              </button>
            } @else {
              <span class="text-[11px] text-text-muted">{{
                'budget.salaryArchive.noPayslip' | transloco
              }}</span>
            }
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg border border-border min-h-8 px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary hover:border-ib-cyan/30 transition-colors"
              [attr.aria-label]="
                'budget.salaryArchive.editAria' | transloco: { month: monthLabel() }
              "
              (click)="edit.emit()"
            >
              <app-icon name="pencil" size="14" /> {{ 'budget.actions.edit' | transloco }}
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg border border-border min-h-8 px-3 py-1.5 text-xs font-medium text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors"
              [attr.aria-label]="
                'budget.salaryArchive.deleteAria' | transloco: { month: monthLabel() }
              "
              (click)="delete.emit()"
            >
              <app-icon name="trash" size="14" /> {{ 'budget.actions.delete' | transloco }}
            </button>
          </div>
        </div>
      }
    </article>
  `,
})
export class SalaryArchiveCard {
  readonly archive = input.required<SalaryArchive>();
  readonly expanded = input.required<boolean>();
  readonly remaining = input.required<number>();
  readonly monthLabel = input.required<string>();
  readonly accountName = input<string | null>(null);
  readonly toggled = output<void>();
  readonly openPayslip = output<void>();
  readonly edit = output<void>();
  readonly delete = output<void>();
}
