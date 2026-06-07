import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Icon } from '@shared/components/icon/icon';
import { EntryRowActions } from '../../../components/entry-row-actions/entry-row-actions';
import { MonthNav } from '../../../components/month-nav/month-nav';
import { TranslocoPipe } from '@jsverse/transloco';
import { RecurringEntry } from '../../../domain/models/recurring-entry.model';

@Component({
  selector: 'app-bank-transfers-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, DatePipe, Icon, MonthNav, EntryRowActions, TranslocoPipe],
  host: { class: 'block space-y-6' },
  template: `
    @if (
      recurringTransfers().length > 0 || monthOneTimeTransfers().length > 0 || accountsCount() > 1
    ) {
      <!-- Virements automatiques -->
      <section class="rounded-xl border border-border bg-surface overflow-hidden">
        <div
          class="flex items-center justify-between px-5 py-3 bg-ib-purple/5 border-b border-border/50"
        >
          <div class="flex items-center gap-2">
            <app-icon name="credit-card" size="16" class="text-ib-purple" />
            <h3 class="text-xs font-semibold uppercase tracking-wider text-ib-purple">
              {{ 'budget.bankAccount.transfers.incomingTitle' | transloco }}
            </h3>
          </div>
        </div>
        @if (recurringTransfers().length > 0) {
          <div class="divide-y divide-border/30">
            @for (entry of recurringTransfers(); track entry.id) {
              @let passed = isExpensePassed()(entry);
              <div
                class="group flex items-center justify-between px-5 py-3.5 hover:bg-ib-purple/3 transition-colors"
                [class.opacity-50]="passed"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold shrink-0"
                    [class.bg-ib-green-10]="passed"
                    [class.text-ib-green]="passed"
                    [class.bg-ib-purple-10]="!passed"
                    [class.text-ib-purple]="!passed"
                  >
                    @if (passed) {
                      <app-icon name="check" size="14" />
                    } @else if (entry.dayOfMonth) {
                      {{ entry.dayOfMonth }}
                    } @else {
                      —
                    }
                  </div>
                  <div>
                    <p
                      class="text-sm font-semibold text-text-primary"
                      [class.line-through]="passed"
                    >
                      {{ entry.label }}
                      @if (entry.autoPost) {
                        <span
                          data-testid="auto-badge"
                          class="ml-1.5 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ib-green bg-ib-green/10"
                          [title]="'budget.recurringForm.autoBadgeTitle' | transloco"
                        >
                          {{ 'budget.recurringForm.autoBadge' | transloco }}
                        </span>
                      }
                    </p>
                    <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                      @if (accountNameById()(entry.accountId); as fromName) {
                        <span class="text-[11px] text-text-muted">{{ fromName }}</span>
                      }
                      <app-icon name="arrow-right" size="10" class="text-text-muted" />
                      @if (accountNameById()(entry.toAccountId); as toName) {
                        <span class="text-[11px] text-ib-purple font-medium">{{ toName }}</span>
                      }
                      @if (entry.endDate) {
                        <span
                          class="inline-flex items-center gap-0.5 rounded-md bg-ib-orange/10 px-1.5 py-0.5 text-[10px] font-medium text-ib-orange"
                        >
                          <app-icon name="calendar" size="9" />
                          {{
                            'budget.bankAccount.expenses.until'
                              | transloco: { date: (entry.endDate | date: 'MM/yyyy') }
                          }}
                        </span>
                      }
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-lg font-mono font-bold text-ib-purple"
                    >{{ entry.amount | number: '1.2-2' }}<span class="text-sm">&euro;</span></span
                  >
                  <app-entry-row-actions
                    [label]="entry.label"
                    (edit)="edit.emit(entry)"
                    (delete)="delete.emit(entry.id)"
                  />
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="px-5 py-8 text-center">
            <app-icon name="credit-card" size="32" class="text-text-muted/20 mx-auto mb-2" />
            <p class="text-sm text-text-muted">
              {{ 'budget.bankAccount.transfers.incomingEmpty' | transloco }}
            </p>
          </div>
        }
      </section>

      <!-- Virements ponctuels -->
      <section class="rounded-xl border border-border bg-surface overflow-hidden">
        <div
          class="flex items-center justify-between px-5 py-3 bg-ib-cyan/5 border-b border-border/50"
        >
          <div class="flex items-center gap-2">
            <app-icon name="arrow-left-right" size="16" class="text-ib-cyan" />
            <h3 class="text-xs font-semibold uppercase tracking-wider text-ib-cyan">
              {{ 'budget.bankAccount.transfers.oneTimeTitle' | transloco }}
            </h3>
            <app-month-nav
              [label]="spendingMonthLabel()"
              accentHover="hover:text-ib-cyan hover:bg-ib-cyan/10"
              (prev)="prevMonth.emit()"
              (next)="nextMonth.emit()"
            />
          </div>
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-lg bg-ib-cyan min-h-8 px-3 py-1.5 text-xs font-medium text-canvas hover:bg-ib-cyan/90 transition-colors shadow-sm"
            (click)="createOneTime.emit()"
          >
            <app-icon name="plus" size="12" />
            {{ 'budget.bankAccount.transfers.addOneTime' | transloco }}
          </button>
        </div>
        @if (monthOneTimeTransfers().length > 0) {
          <div class="divide-y divide-border/30">
            @for (entry of monthOneTimeTransfers(); track entry.id) {
              @let isOutgoing = entry.accountId === selectedAccountId();
              <div
                class="group flex items-center justify-between px-5 py-3.5 hover:bg-ib-cyan/3 transition-colors"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold shrink-0 bg-ib-cyan/10 text-ib-cyan"
                  >
                    @if (entry.date) {
                      {{ entry.date | date: 'dd' }}
                    } @else {
                      —
                    }
                  </div>
                  <div>
                    <p class="text-sm font-semibold text-text-primary">{{ entry.label }}</p>
                    <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                      @if (accountNameById()(entry.accountId); as fromName) {
                        <span class="text-[11px] text-text-muted">{{ fromName }}</span>
                      }
                      <app-icon name="arrow-right" size="10" class="text-text-muted" />
                      @if (accountNameById()(entry.toAccountId); as toName) {
                        <span class="text-[11px] text-ib-cyan font-medium">{{ toName }}</span>
                      }
                      @if (entry.date) {
                        <span class="text-[10px] text-text-muted">{{
                          entry.date | date: 'dd/MM'
                        }}</span>
                      }
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <span
                    class="text-lg font-mono font-bold"
                    [class.text-ib-red]="isOutgoing"
                    [class.text-ib-green]="!isOutgoing"
                  >
                    {{ isOutgoing ? '-' : '+' }}{{ entry.amount | number: '1.2-2'
                    }}<span class="text-sm">&euro;</span>
                  </span>
                  <app-entry-row-actions
                    [label]="entry.label"
                    (edit)="edit.emit(entry)"
                    (delete)="delete.emit(entry.id)"
                  />
                </div>
              </div>
            }
          </div>
          <div
            class="px-5 py-2.5 border-t border-border/50 bg-canvas/50 flex justify-between items-center"
          >
            <span class="text-[10px] font-medium text-text-muted uppercase tracking-wider">{{
              'budget.bankAccount.transfers.monthTotal' | transloco
            }}</span>
            <div class="flex items-center gap-3 text-[11px]">
              @if (totalOneTimeOutgoing() > 0) {
                <span class="flex items-center gap-1">
                  <span class="text-text-muted">{{
                    'budget.bankAccount.transfers.outgoing' | transloco
                  }}</span>
                  <span class="font-mono text-ib-red"
                    >-{{ totalOneTimeOutgoing() | number: '1.2-2' }}&euro;</span
                  >
                </span>
              }
              @if (totalOneTimeIncoming() > 0) {
                <span class="flex items-center gap-1">
                  <span class="text-text-muted">{{
                    'budget.bankAccount.transfers.incoming' | transloco
                  }}</span>
                  <span class="font-mono text-ib-green"
                    >+{{ totalOneTimeIncoming() | number: '1.2-2' }}&euro;</span
                  >
                </span>
              }
            </div>
          </div>
        } @else {
          <div class="px-5 py-8 text-center">
            <app-icon name="arrow-left-right" size="32" class="text-text-muted/20 mx-auto mb-2" />
            <p class="text-sm text-text-muted">
              {{
                'budget.bankAccount.transfers.oneTimeEmpty'
                  | transloco: { month: spendingMonthLabel() }
              }}
            </p>
          </div>
        }
      </section>
    }
  `,
})
export class BankTransfersPanel {
  readonly recurringTransfers = input.required<RecurringEntry[]>();
  readonly monthOneTimeTransfers = input.required<RecurringEntry[]>();
  readonly totalOneTimeOutgoing = input.required<number>();
  readonly totalOneTimeIncoming = input.required<number>();
  readonly selectedAccountId = input.required<string | null>();
  readonly memberMap = input.required<Map<string, { name: string; color: string }>>();
  readonly accountNameById = input.required<(id: string | null) => string | null>();
  readonly isExpensePassed = input.required<(entry: RecurringEntry) => boolean>();
  readonly spendingMonthLabel = input.required<string>();
  readonly accountsCount = input.required<number>();

  readonly createOneTime = output<void>();
  readonly edit = output<RecurringEntry>();
  readonly delete = output<string>();
  readonly prevMonth = output<void>();
  readonly nextMonth = output<void>();
}
