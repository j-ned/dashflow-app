import { afterNextRender, ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Icon } from '@shared/components/icon/icon';
import { EntryRowActions } from '../../../components/entry-row-actions/entry-row-actions';
import { MonthNav } from '../../../components/month-nav/month-nav';
import { TranslocoPipe } from '@jsverse/transloco';
import { RecurringEntry } from '../../../domain/models/recurring-entry.model';

@Component({
  selector: 'app-bank-expense-columns',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, DatePipe, Icon, MonthNav, EntryRowActions, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

      <!-- Prélèvements mensuels -->
      <section class="rounded-xl border border-border bg-surface overflow-hidden" #refCard>
        <div class="flex items-center justify-between px-4 py-3 bg-ib-red/5 border-b border-border/50">
          <div class="flex items-center gap-2">
            <app-icon name="receipt" size="14" class="text-ib-red" />
            <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ib-red">{{ 'budget.bankAccount.expenses.monthlyTitle' | transloco }}</h3>
          </div>
          <button type="button"
                  class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-red text-canvas hover:bg-ib-red/80 transition-colors shadow-sm"
                  [title]="'budget.bankAccount.expenses.addMonthly' | transloco"
                  [attr.aria-label]="'budget.bankAccount.expenses.addMonthly' | transloco"
                  (click)="createMonthly.emit()">
            <app-icon name="plus" size="12" />
          </button>
        </div>
        @if (monthlyExpenses().length > 0) {
          <div class="divide-y divide-border/20 px-3 py-1.5">
            @for (entry of monthlyExpenses(); track entry.id) {
              @let passed = isExpensePassed()(entry);
              <div class="group flex items-center justify-between py-2 hover:bg-ib-red/3 rounded-lg px-1.5 -mx-1.5 transition-colors"
                   [class.opacity-50]="passed">
                <div class="flex items-center gap-2 min-w-0">
                  <div class="flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold shrink-0"
                       [class.bg-ib-red-10]="!passed" [class.text-ib-red]="!passed"
                       [class.bg-ib-green-10]="passed" [class.text-ib-green]="passed">
                    @if (passed) { <app-icon name="check" size="14" /> } @else if (entry.dayOfMonth) { {{ entry.dayOfMonth }} } @else { — }
                  </div>
                  <div class="min-w-0">
                    <p class="text-[13px] font-medium text-text-primary truncate" [class.line-through]="passed">{{ entry.label }}@if (entry.autoPost) {
                      <span data-testid="auto-badge"
                            class="ml-1.5 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ib-green bg-ib-green/10"
                            [title]="'budget.recurringForm.autoBadgeTitle' | transloco">
                        {{ 'budget.recurringForm.autoBadge' | transloco }}
                      </span>
                    }</p>
                    <div class="flex items-center gap-1 flex-wrap">
                      @if (entry.category) {
                        <span class="text-[10px] text-text-muted">{{ entry.category }}</span>
                      }
                      @if (memberMap().get(entry.memberId ?? '')?.name; as mName) {
                        <span class="text-[10px] text-text-muted">{{ mName }}</span>
                      }
                      @if (passed) {
                        <span class="text-[10px] text-ib-green font-medium">{{ 'budget.bankAccount.expenses.debited' | transloco }}</span>
                      } @else if (entry.dayOfMonth) {
                        <span class="text-[10px] text-text-muted">{{ 'budget.bankAccount.expenses.onDay' | transloco: { day: entry.dayOfMonth } }}</span>
                      }
                      @if (entry.endDate) {
                        <span class="inline-flex items-center gap-0.5 rounded-md bg-ib-orange/10 px-1.5 py-0.5 text-[10px] font-medium text-ib-orange">
                          <app-icon name="calendar" size="9" /> {{ 'budget.bankAccount.expenses.until' | transloco: { date: (entry.endDate | date:'MM/yyyy') } }}
                        </span>
                      }
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <span class="text-[13px] font-mono font-bold" [class.text-ib-red]="!passed" [class.text-text-muted]="passed">-{{ entry.amount | number:'1.2-2' }}&euro;</span>
                  <app-entry-row-actions [label]="entry.label" variant="compact" (edit)="edit.emit(entry)" (delete)="delete.emit(entry.id)" />
                </div>
              </div>
            }
          </div>
          <div class="px-4 py-2.5 border-t border-border/50 bg-canvas/50 flex justify-between items-center">
            <span class="text-[10px] font-medium text-text-muted uppercase tracking-wider">{{ 'budget.bankAccount.expenses.total' | transloco }}</span>
            <span class="text-sm font-mono font-bold text-ib-red">{{ totalMonthlyExpenses() | number:'1.2-2' }} &euro;</span>
          </div>
        } @else {
          <div class="flex items-center justify-center py-8 px-4">
            <p class="text-xs text-text-muted text-center">{{ 'budget.bankAccount.expenses.monthlyEmpty' | transloco }}</p>
          </div>
        }
      </section>

      <!-- Prélèvements annuels -->
      <section class="rounded-xl border border-border bg-surface overflow-hidden flex flex-col" [style.max-height.px]="refCardHeight()">
        <div class="flex items-center justify-between px-4 py-3 bg-ib-orange/5 border-b border-border/50">
          <div class="flex items-center gap-2">
            <app-icon name="calendar" size="14" class="text-ib-orange" />
            <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ib-orange">{{ 'budget.bankAccount.expenses.annualTitle' | transloco }}</h3>
          </div>
          <button type="button"
                  class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-orange text-canvas hover:bg-ib-orange/80 transition-colors shadow-sm"
                  [title]="'budget.bankAccount.expenses.addAnnual' | transloco"
                  [attr.aria-label]="'budget.bankAccount.expenses.addAnnual' | transloco"
                  (click)="createAnnual.emit()">
            <app-icon name="plus" size="12" />
          </button>
        </div>
        @if (annualExpenses().length > 0) {
          <div class="divide-y divide-border/20 px-3 py-1.5 overflow-y-auto flex-1">
            @for (entry of annualExpenses(); track entry.id) {
              <div class="group flex items-center justify-between py-2 hover:bg-ib-orange/3 rounded-lg px-1.5 -mx-1.5 transition-colors">
                <div class="flex items-center gap-2 min-w-0">
                  <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-ib-orange/10 text-ib-orange text-[10px] font-bold shrink-0"
                       [title]="entry.date ? '' : ('budget.bankAccount.expenses.annualNoDate' | transloco)">
                    @if (entry.date) { {{ entry.date | date:'MMM' }} } @else { <app-icon name="calendar" size="12" /> }
                  </div>
                  <div class="min-w-0">
                    <p class="text-[13px] font-medium text-text-primary truncate">{{ entry.label }}</p>
                    <div class="flex items-center gap-1 flex-wrap">
                      <span class="text-[10px] text-text-muted">{{ 'budget.bankAccount.expenses.monthlyApprox' | transloco: { value: (entry.amount / 12 | number:'1.2-2') } }}</span>
                      @if (entry.category) {
                        <span class="text-[10px] text-text-muted">{{ entry.category }}</span>
                      }
                      @if (memberMap().get(entry.memberId ?? '')?.name; as mName) {
                        <span class="text-[10px] text-text-muted">{{ mName }}</span>
                      }
                      @if (entry.endDate) {
                        <span class="inline-flex items-center gap-0.5 rounded-md bg-ib-orange/10 px-1.5 py-0.5 text-[10px] font-medium text-ib-orange">
                          <app-icon name="calendar" size="9" /> {{ 'budget.bankAccount.expenses.until' | transloco: { date: (entry.endDate | date:'MM/yyyy') } }}
                        </span>
                      }
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <span class="text-[13px] font-mono font-bold text-ib-orange">-{{ entry.amount | number:'1.2-2' }}&euro;</span>
                  <app-entry-row-actions [label]="entry.label" variant="compact" (edit)="edit.emit(entry)" (delete)="delete.emit(entry.id)" />
                </div>
              </div>
            }
          </div>
          <div class="px-4 py-2.5 border-t border-border/50 bg-canvas/50 flex justify-between items-center">
            <span class="text-[10px] font-medium text-text-muted uppercase tracking-wider">{{ 'budget.bankAccount.expenses.total' | transloco }}</span>
            <div class="text-right">
              <span class="text-sm font-mono font-bold text-ib-orange">{{ totalAnnualExpenses() | number:'1.2-2' }} {{ 'budget.bankAccount.expenses.annualSuffix' | transloco }}</span>
              <span class="text-[10px] text-text-muted ml-1">{{ 'budget.bankAccount.expenses.annualMonthlySuffix' | transloco: { value: (monthlyAnnualExpenses() | number:'1.2-2') } }}</span>
            </div>
          </div>
        } @else {
          <div class="flex items-center justify-center py-8 px-4">
            <p class="text-xs text-text-muted text-center">{{ 'budget.bankAccount.expenses.annualEmpty' | transloco }}</p>
          </div>
        }
      </section>

      <!-- Dépenses -->
      <section class="rounded-xl border border-border bg-surface overflow-hidden flex flex-col" [style.max-height.px]="refCardHeight()">
        <div class="flex items-center justify-between px-4 py-3 bg-ib-yellow/5 border-b border-border/50">
          <div class="flex items-center gap-2">
            <app-icon name="banknote" size="14" class="text-ib-yellow" />
            <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ib-yellow">{{ 'budget.bankAccount.expenses.spendingsTitle' | transloco }}</h3>
            <app-month-nav
              [label]="spendingMonthLabel()"
              accentHover="hover:text-ib-yellow hover:bg-ib-yellow/10"
              (prev)="prevMonth.emit()"
              (next)="nextMonth.emit()"
            />
          </div>
          <button type="button"
                  class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-yellow text-canvas hover:bg-ib-yellow/80 transition-colors shadow-sm"
                  [title]="'budget.bankAccount.expenses.addSpending' | transloco"
                  [attr.aria-label]="'budget.bankAccount.expenses.addSpending' | transloco"
                  (click)="createSpending.emit()">
            <app-icon name="plus" size="12" />
          </button>
        </div>
        @if (monthSpendings().length > 0) {
          <div class="divide-y divide-border/20 px-3 py-1.5 overflow-y-auto flex-1">
            @for (entry of monthSpendings(); track entry.id) {
              <div class="group flex items-center justify-between py-2 hover:bg-ib-yellow/3 rounded-lg px-1.5 -mx-1.5 transition-colors">
                <div class="flex items-center gap-2 min-w-0">
                  <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-ib-yellow/10 text-ib-yellow text-[10px] font-bold shrink-0">
                    @if (entry.date) { {{ entry.date | date:'dd' }} } @else if (entry.dayOfMonth) { {{ entry.dayOfMonth }} } @else { — }
                  </div>
                  <div class="min-w-0">
                    <p class="text-[13px] font-medium text-text-primary truncate">{{ entry.label }}</p>
                    <div class="flex items-center gap-1 flex-wrap">
                      @if (entry.category) {
                        <span class="text-[10px] text-text-muted">{{ entry.category }}</span>
                      }
                      @if (entry.date) {
                        <span class="text-[10px] text-text-muted">{{ entry.date | date:'dd/MM' }}</span>
                      }
                      @if (memberMap().get(entry.memberId ?? '')?.name; as mName) {
                        <span class="text-[10px] text-text-muted">{{ mName }}</span>
                      }
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <span class="text-[13px] font-mono font-bold text-ib-yellow">-{{ entry.amount | number:'1.2-2' }}&euro;</span>
                  <app-entry-row-actions [label]="entry.label" variant="compact" (edit)="edit.emit(entry)" (delete)="delete.emit(entry.id)" />
                </div>
              </div>
            }
          </div>
          <div class="px-4 py-2.5 border-t border-border/50 bg-canvas/50 flex justify-between items-center">
            <span class="text-[10px] font-medium text-text-muted uppercase tracking-wider">{{ 'budget.bankAccount.expenses.total' | transloco }}</span>
            <span class="text-sm font-mono font-bold text-ib-yellow">{{ totalMonthSpendings() | number:'1.2-2' }} &euro;</span>
          </div>
        } @else {
          <div class="flex items-center justify-center py-8 px-4">
            <p class="text-xs text-text-muted text-center">{{ 'budget.bankAccount.expenses.spendingsEmpty' | transloco: { month: spendingMonthLabel() } }}</p>
          </div>
        }
      </section>
    </div>
  `,
})
export class BankExpenseColumns {
  readonly monthlyExpenses = input.required<RecurringEntry[]>();
  readonly annualExpenses = input.required<RecurringEntry[]>();
  readonly monthSpendings = input.required<RecurringEntry[]>();
  readonly totalMonthlyExpenses = input.required<number>();
  readonly totalAnnualExpenses = input.required<number>();
  readonly monthlyAnnualExpenses = input.required<number>();
  readonly totalMonthSpendings = input.required<number>();
  readonly spendingMonthLabel = input.required<string>();
  readonly memberMap = input.required<Map<string, { name: string; color: string }>>();
  readonly isExpensePassed = input.required<(entry: RecurringEntry) => boolean>();

  readonly createMonthly = output<void>();
  readonly createAnnual = output<void>();
  readonly createSpending = output<void>();
  readonly edit = output<RecurringEntry>();
  readonly delete = output<string>();
  readonly prevMonth = output<void>();
  readonly nextMonth = output<void>();

  private readonly _refCard = viewChild<ElementRef<HTMLElement>>('refCard');
  protected readonly refCardHeight = signal<number | null>(null);

  constructor() {
    afterNextRender(() => {
      const el = this._refCard()?.nativeElement;
      if (!el) return;
      const ro = new ResizeObserver(([entry]) => this.refCardHeight.set(entry.borderBoxSize[0].blockSize));
      ro.observe(el);
    });
  }
}
