import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { HistoryEntry } from '../../domain/envelope-history';
import { Icon } from '@shared/components/icon/icon';

@Component({
  selector: 'app-envelope-history-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, Icon, TranslocoPipe],
  template: `
    @if (history().length > 0) {
      <ul class="divide-y divide-border/40 rounded-lg border border-border overflow-hidden">
        @for (entry of history(); track entry.tx.id) {
          <li class="flex items-center justify-between gap-3 px-4 py-3">
            <div class="flex min-w-0 items-center gap-3">
              <span
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                [class.bg-ib-green]="entry.tx.amount >= 0"
                [class.bg-ib-red]="entry.tx.amount < 0"
                [style.background-color]="
                  entry.tx.amount >= 0
                    ? 'color-mix(in srgb, var(--color-ib-green) 12%, transparent)'
                    : 'color-mix(in srgb, var(--color-ib-red) 12%, transparent)'
                "
              >
                <app-icon
                  [name]="entry.tx.amount >= 0 ? 'arrow-up-right' : 'arrow-down-left'"
                  size="14"
                  [class.text-ib-green]="entry.tx.amount >= 0"
                  [class.text-ib-red]="entry.tx.amount < 0"
                />
              </span>
              <div class="min-w-0">
                <p
                  class="font-mono text-sm font-medium"
                  [class.text-ib-green]="entry.tx.amount >= 0"
                  [class.text-ib-red]="entry.tx.amount < 0"
                >
                  {{ entry.tx.amount >= 0 ? '+' : '' }}{{ entry.tx.amount | number: '1.2-2' }}&euro;
                </p>
                @if (entry.tx.note) {
                  <p class="truncate text-xs text-text-muted">{{ entry.tx.note }}</p>
                }
              </div>
            </div>
            <div class="shrink-0 text-right">
              <p class="text-xs text-text-muted">{{ entry.tx.date | date: 'dd/MM/yyyy' }}</p>
              <p class="font-mono text-xs text-text-muted">
                {{ 'budget.envelope.balanceAfter' | transloco }}
                {{ entry.balanceAfter | number: '1.2-2' }}&euro;
              </p>
            </div>
          </li>
        }
      </ul>
    } @else {
      <div class="text-center py-8">
        <app-icon name="clock" size="32" class="text-text-muted/20 mx-auto mb-2" />
        <p class="text-sm text-text-muted">
          {{ 'budget.envelope.modal.noTransactions' | transloco }}
        </p>
        <p class="text-xs text-text-muted mt-1">
          {{ 'budget.envelope.modal.historyHint' | transloco }}
        </p>
      </div>
    }
  `,
})
export class EnvelopeHistoryList {
  readonly history = input<HistoryEntry[]>([]);
}
