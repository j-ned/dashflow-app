import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { Loan } from '../../domain/models/loan.model';
import { HistoryEntry } from '../../domain/loan-vm';
import { Icon } from '@shared/components/icon/icon';

@Component({
  selector: 'app-loan-history-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, Icon, TranslocoPipe],
  template: `
    @if (loan(); as loan) {
      @let repaid = loan.amount - loan.remaining;
      @let pct = loan.amount > 0 ? (repaid / loan.amount) * 100 : 0;
      <div class="mb-4 rounded-lg border border-border bg-raised/40 p-4">
        <div class="grid grid-cols-3 gap-3 text-center">
          <div>
            <p class="text-[11px] uppercase tracking-wider text-text-muted">
              {{ 'budget.loan.modal.initialAmount' | transloco }}
            </p>
            <p class="mt-0.5 font-mono font-semibold text-text-primary">
              {{ loan.amount | number: '1.2-2' }}&euro;
            </p>
          </div>
          <div>
            <p class="text-[11px] uppercase tracking-wider text-text-muted">
              {{ 'budget.loan.repaid' | transloco }}
            </p>
            <p class="mt-0.5 font-mono font-semibold text-ib-green">
              {{ repaid | number: '1.2-2' }}&euro;
            </p>
          </div>
          <div>
            <p class="text-[11px] uppercase tracking-wider text-text-muted">
              {{ 'budget.loan.remaining' | transloco }}
            </p>
            <p
              class="mt-0.5 font-mono font-semibold"
              [class.text-ib-blue]="loan.direction === 'lent'"
              [class.text-ib-red]="loan.direction === 'borrowed'"
            >
              {{ loan.remaining | number: '1.2-2' }}&euro;
            </p>
          </div>
        </div>
        <div class="mt-3 h-2 rounded-full bg-hover overflow-hidden">
          <div
            class="h-full rounded-full bg-ib-green"
            [style.width.%]="pct > 100 ? 100 : pct"
          ></div>
        </div>
        <p class="mt-1 text-right text-[11px] text-text-muted">
          {{ 'budget.loan.modal.progress' | transloco: { pct: (pct | number: '1.0-0') } }}
        </p>
      </div>
    }

    @if (history().length > 0) {
      <ul class="divide-y divide-border/40 rounded-lg border border-border overflow-hidden">
        @for (entry of history(); track entry.tx.id) {
          <li class="flex items-center justify-between gap-3 px-4 py-3">
            <div class="flex min-w-0 items-center gap-3">
              <span
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                [style.background-color]="'color-mix(in srgb, var(--color-ib-green) 12%, transparent)'"
              >
                <app-icon name="banknote" size="14" class="text-ib-green" />
              </span>
              <div class="min-w-0">
                <p class="font-mono text-sm font-medium text-ib-green">
                  +{{ entry.tx.amount | number: '1.2-2' }}&euro;
                </p>
                @if (entry.tx.note) {
                  <p class="truncate text-xs text-text-muted">{{ entry.tx.note }}</p>
                }
              </div>
            </div>
            <div class="shrink-0 text-right">
              <p class="text-xs text-text-muted">{{ entry.tx.date | date: 'dd/MM/yyyy' }}</p>
              <p class="font-mono text-xs text-text-muted">
                {{ 'budget.loan.remainingAfter' | transloco }}
                {{ entry.balanceAfter | number: '1.2-2' }}&euro;
              </p>
            </div>
          </li>
        }
      </ul>
    } @else {
      <div class="text-center py-8">
        <app-icon name="clock" size="32" class="text-text-muted/20 mx-auto mb-2" />
        <p class="text-sm text-text-muted">{{ 'budget.loan.modal.noPayments' | transloco }}</p>
        <p class="text-xs text-text-muted mt-1">
          {{ 'budget.loan.modal.historyHint' | transloco }}
        </p>
      </div>
    }
  `,
})
export class LoanHistoryDetail {
  readonly loan = input<Loan | null>(null);
  readonly history = input<HistoryEntry[]>([]);
}
