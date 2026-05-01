import { afterNextRender, ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Icon } from '@shared/components/icon/icon';
import { RecurringEntry } from '../../../domain/models/recurring-entry.model';

@Component({
  selector: 'app-bank-expense-columns',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, DatePipe, Icon],
  host: { class: 'block' },
  template: `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

      <!-- Prélèvements mensuels -->
      <section class="rounded-xl border border-border bg-surface overflow-hidden" #refCard>
        <div class="flex items-center justify-between px-4 py-3 bg-ib-red/5 border-b border-border/50">
          <div class="flex items-center gap-2">
            <app-icon name="receipt" size="14" class="text-ib-red" />
            <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ib-red">Mensuels</h3>
          </div>
          <button type="button"
                  class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-red text-canvas hover:bg-ib-red/80 transition-colors shadow-sm"
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
                    <p class="text-[13px] font-medium text-text-primary truncate" [class.line-through]="passed">{{ entry.label }}</p>
                    <div class="flex items-center gap-1 flex-wrap">
                      @if (entry.category) {
                        <span class="text-[10px] text-text-muted">{{ entry.category }}</span>
                      }
                      @if (memberMap().get(entry.memberId ?? '')?.name; as mName) {
                        <span class="text-[10px] text-text-muted">{{ mName }}</span>
                      }
                      @if (passed) {
                        <span class="text-[10px] text-ib-green font-medium">Prélevé</span>
                      } @else if (entry.dayOfMonth) {
                        <span class="text-[10px] text-text-muted">le {{ entry.dayOfMonth }}</span>
                      }
                      @if (entry.endDate) {
                        <span class="inline-flex items-center gap-0.5 rounded-md bg-ib-orange/10 px-1.5 py-0.5 text-[10px] font-medium text-ib-orange">
                          <app-icon name="calendar" size="9" /> Jusqu'au {{ entry.endDate | date:'MM/yyyy' }}
                        </span>
                      }
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <span class="text-[13px] font-mono font-bold" [class.text-ib-red]="!passed" [class.text-text-muted]="passed">-{{ entry.amount | number:'1.2-2' }}&euro;</span>
                  <div class="flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button type="button" class="rounded p-1 text-text-muted hover:text-ib-yellow transition-colors"
                            [title]="'Modifier — ' + entry.label" [attr.aria-label]="'Modifier ' + entry.label"
                            (click)="edit.emit(entry)">
                      <app-icon name="pencil" size="11" />
                    </button>
                    <button type="button" class="rounded p-1 text-text-muted hover:text-ib-red transition-colors"
                            [title]="'Supprimer — ' + entry.label" [attr.aria-label]="'Supprimer ' + entry.label"
                            (click)="delete.emit(entry.id)">
                      <app-icon name="trash" size="11" />
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
          <div class="px-4 py-2.5 border-t border-border/50 bg-canvas/50 flex justify-between items-center">
            <span class="text-[10px] font-medium text-text-muted uppercase tracking-wider">Total</span>
            <span class="text-sm font-mono font-bold text-ib-red">{{ totalMonthlyExpenses() | number:'1.2-2' }} &euro;</span>
          </div>
        } @else {
          <div class="flex items-center justify-center py-8 px-4">
            <p class="text-xs text-text-muted text-center">Loyer, abonnements, assurances...</p>
          </div>
        }
      </section>

      <!-- Prélèvements annuels -->
      <section class="rounded-xl border border-border bg-surface overflow-hidden flex flex-col" [style.max-height.px]="refCardHeight()">
        <div class="flex items-center justify-between px-4 py-3 bg-ib-orange/5 border-b border-border/50">
          <div class="flex items-center gap-2">
            <app-icon name="calendar" size="14" class="text-ib-orange" />
            <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ib-orange">Annuels</h3>
          </div>
          <button type="button"
                  class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-orange text-canvas hover:bg-ib-orange/80 transition-colors shadow-sm"
                  (click)="createAnnual.emit()">
            <app-icon name="plus" size="12" />
          </button>
        </div>
        @if (annualExpenses().length > 0) {
          <div class="divide-y divide-border/20 px-3 py-1.5 overflow-y-auto flex-1">
            @for (entry of annualExpenses(); track entry.id) {
              <div class="group flex items-center justify-between py-2 hover:bg-ib-orange/3 rounded-lg px-1.5 -mx-1.5 transition-colors">
                <div class="flex items-center gap-2 min-w-0">
                  <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-ib-orange/10 text-ib-orange text-[10px] font-bold shrink-0">
                    @if (entry.date) { {{ entry.date | date:'MMM' }} } @else { AN }
                  </div>
                  <div class="min-w-0">
                    <p class="text-[13px] font-medium text-text-primary truncate">{{ entry.label }}</p>
                    <div class="flex items-center gap-1 flex-wrap">
                      <span class="text-[10px] text-text-muted">~{{ entry.amount / 12 | number:'1.2-2' }}&euro;/mois</span>
                      @if (entry.category) {
                        <span class="text-[10px] text-text-muted">{{ entry.category }}</span>
                      }
                      @if (memberMap().get(entry.memberId ?? '')?.name; as mName) {
                        <span class="text-[10px] text-text-muted">{{ mName }}</span>
                      }
                      @if (entry.endDate) {
                        <span class="inline-flex items-center gap-0.5 rounded-md bg-ib-orange/10 px-1.5 py-0.5 text-[10px] font-medium text-ib-orange">
                          <app-icon name="calendar" size="9" /> Jusqu'au {{ entry.endDate | date:'MM/yyyy' }}
                        </span>
                      }
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <span class="text-[13px] font-mono font-bold text-ib-orange">-{{ entry.amount | number:'1.2-2' }}&euro;</span>
                  <div class="flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button type="button" class="rounded p-1 text-text-muted hover:text-ib-yellow transition-colors"
                            [title]="'Modifier — ' + entry.label" [attr.aria-label]="'Modifier ' + entry.label"
                            (click)="edit.emit(entry)">
                      <app-icon name="pencil" size="11" />
                    </button>
                    <button type="button" class="rounded p-1 text-text-muted hover:text-ib-red transition-colors"
                            [title]="'Supprimer — ' + entry.label" [attr.aria-label]="'Supprimer ' + entry.label"
                            (click)="delete.emit(entry.id)">
                      <app-icon name="trash" size="11" />
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
          <div class="px-4 py-2.5 border-t border-border/50 bg-canvas/50 flex justify-between items-center">
            <span class="text-[10px] font-medium text-text-muted uppercase tracking-wider">Total</span>
            <div class="text-right">
              <span class="text-sm font-mono font-bold text-ib-orange">{{ totalAnnualExpenses() | number:'1.2-2' }} &euro;/an</span>
              <span class="text-[10px] text-text-muted ml-1">(~{{ monthlyAnnualExpenses() | number:'1.2-2' }}&euro;/m)</span>
            </div>
          </div>
        } @else {
          <div class="flex items-center justify-center py-8 px-4">
            <p class="text-xs text-text-muted text-center">Assurance auto, impôts fonciers...</p>
          </div>
        }
      </section>

      <!-- Dépenses -->
      <section class="rounded-xl border border-border bg-surface overflow-hidden flex flex-col" [style.max-height.px]="refCardHeight()">
        <div class="flex items-center justify-between px-4 py-3 bg-ib-yellow/5 border-b border-border/50">
          <div class="flex items-center gap-2">
            <app-icon name="banknote" size="14" class="text-ib-yellow" />
            <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ib-yellow">Dépenses</h3>
            <div class="flex items-center gap-0.5 ml-1">
              <button type="button"
                      class="rounded p-0.5 text-text-muted hover:text-ib-yellow hover:bg-ib-yellow/10 transition-colors"
                      (click)="prevMonth.emit()">
                <app-icon name="chevron-right" size="12" class="rotate-180" />
              </button>
              <span class="text-[11px] font-medium text-text-primary min-w-20 text-center">{{ spendingMonthLabel() }}</span>
              <button type="button"
                      class="rounded p-0.5 text-text-muted hover:text-ib-yellow hover:bg-ib-yellow/10 transition-colors"
                      (click)="nextMonth.emit()">
                <app-icon name="chevron-right" size="12" />
              </button>
            </div>
          </div>
          <button type="button"
                  class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-yellow text-canvas hover:bg-ib-yellow/80 transition-colors shadow-sm"
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
                  <div class="flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button type="button" class="rounded p-1 text-text-muted hover:text-ib-yellow transition-colors"
                            [title]="'Modifier — ' + entry.label" [attr.aria-label]="'Modifier ' + entry.label"
                            (click)="edit.emit(entry)">
                      <app-icon name="pencil" size="11" />
                    </button>
                    <button type="button" class="rounded p-1 text-text-muted hover:text-ib-red transition-colors"
                            [title]="'Supprimer — ' + entry.label" [attr.aria-label]="'Supprimer ' + entry.label"
                            (click)="delete.emit(entry.id)">
                      <app-icon name="trash" size="11" />
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
          <div class="px-4 py-2.5 border-t border-border/50 bg-canvas/50 flex justify-between items-center">
            <span class="text-[10px] font-medium text-text-muted uppercase tracking-wider">Total</span>
            <span class="text-sm font-mono font-bold text-ib-yellow">{{ totalMonthSpendings() | number:'1.2-2' }} &euro;</span>
          </div>
        } @else {
          <div class="flex items-center justify-center py-8 px-4">
            <p class="text-xs text-text-muted text-center">Aucune dépense en {{ spendingMonthLabel() }}</p>
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
