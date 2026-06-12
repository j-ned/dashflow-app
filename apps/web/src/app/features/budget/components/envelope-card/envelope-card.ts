import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { Envelope } from '../../domain/models/envelope.model';
import { HistoryEntry } from '../../domain/envelope-history';
import { MemberDisplay } from '../../domain/member-map';
import { Icon } from '@shared/components/icon/icon';

@Component({
  selector: 'app-envelope-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, Icon, TranslocoPipe],
  host: { class: 'contents' },
  template: `
    <article
      class="flex flex-col rounded-lg border border-border bg-surface transition hover:border-border/80"
    >
      <div class="p-5">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              [style.background-color]="envelope().color + '1a'"
            >
              <app-icon name="wallet" size="18" [style.color]="envelope().color" />
            </span>
            <div class="min-w-0">
              <h3 class="truncate font-semibold text-text-primary">{{ envelope().name }}</h3>
              <p
                class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-muted"
              >
                @if (member(); as member) {
                  <span class="inline-flex items-center gap-1">
                    <span
                      class="inline-block h-2 w-2 rounded-full"
                      [style.background-color]="member.color"
                    ></span>
                    {{ member.name }}
                  </span>
                }
                @if (envelope().dueDay) {
                  <span>{{
                    'budget.envelope.dueDayLabel' | transloco: { day: envelope().dueDay }
                  }}</span>
                }
              </p>
            </div>
          </div>
          <span
            class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            [style.background-color]="envelope().color + '1a'"
            [style.color]="envelope().color"
            >{{ envelope().type }}</span
          >
        </div>

        <p class="mt-4 font-mono text-3xl font-bold tracking-tight text-text-primary">
          {{ envelope().balance | number: '1.2-2'
          }}<span class="ml-1 text-lg text-text-muted">&euro;</span>
        </p>

        @if (envelope().target) {
          @let pct = (envelope().balance / envelope().target!) * 100;
          @let remaining = envelope().target! - envelope().balance;
          <div class="mt-3">
            <div class="h-2 overflow-hidden rounded-full bg-hover">
              <div
                class="h-full rounded-full"
                [style.width.%]="pct > 100 ? 100 : pct"
                [style.background-color]="envelope().color"
              ></div>
            </div>
            <div class="mt-1.5 flex items-center justify-between text-xs">
              <span class="text-text-muted">
                {{ 'budget.envelope.objective' | transloco }}
                <span class="font-mono text-text-primary"
                  >{{ envelope().target | number: '1.0-0' }}&euro;</span
                >
              </span>
              <span
                class="font-mono font-semibold"
                [class.text-ib-green]="remaining <= 0"
                [class.text-text-muted]="remaining > 0"
              >
                {{
                  remaining > 0
                    ? ('budget.envelope.remainingShort'
                      | transloco: { amount: (remaining | number: '1.0-0') })
                    : ('budget.envelope.reached' | transloco)
                }}
                · {{ pct | number: '1.0-0' }}%
              </span>
            </div>
          </div>
        } @else {
          <p class="mt-2 text-xs text-text-muted">
            {{ 'budget.envelope.noObjective' | transloco }}
          </p>
        }

        <div class="mt-4 border-t border-border/60 pt-3">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{{
              'budget.envelope.recentActivity' | transloco
            }}</span>
            @if (entries().length > 0) {
              <button
                type="button"
                class="text-[11px] font-medium text-ib-cyan hover:underline"
                (click)="history.emit()"
              >
                {{ 'budget.envelope.viewAll' | transloco }}
              </button>
            }
          </div>
          @if (entries().length > 0) {
            <ul class="space-y-1.5">
              @for (entry of recentEntries(); track entry.tx.id) {
                <li class="flex items-center justify-between gap-2 text-xs">
                  <span class="flex min-w-0 items-center gap-1.5">
                    <app-icon
                      [name]="entry.tx.amount >= 0 ? 'arrow-up-right' : 'arrow-down-left'"
                      size="12"
                      [class.text-ib-green]="entry.tx.amount >= 0"
                      [class.text-ib-red]="entry.tx.amount < 0"
                    />
                    <span class="truncate text-text-muted">{{
                      entry.tx.note || (entry.tx.date | date: 'dd/MM/yy')
                    }}</span>
                  </span>
                  <span
                    class="shrink-0 font-mono"
                    [class.text-ib-green]="entry.tx.amount >= 0"
                    [class.text-ib-red]="entry.tx.amount < 0"
                  >
                    {{ entry.tx.amount >= 0 ? '+' : ''
                    }}{{ entry.tx.amount | number: '1.2-2' }}&euro;
                  </span>
                </li>
              }
            </ul>
          } @else {
            <p class="text-xs text-text-muted">
              {{ 'budget.envelope.noActivity' | transloco }}
            </p>
          }
        </div>
      </div>

      <div class="mt-auto flex flex-wrap items-center gap-2 border-t border-border/60 px-5 py-3">
        <button
          type="button"
          class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-ib-cyan/10 px-3 py-2 text-xs font-semibold text-ib-cyan transition-colors hover:bg-ib-cyan/20"
          (click)="credit.emit()"
        >
          <app-icon name="plus" size="14" /> {{ 'budget.envelope.creditAction' | transloco }}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:bg-hover hover:text-text-primary"
          [attr.aria-label]="'budget.envelope.editAria' | transloco: { name: envelope().name }"
          (click)="edit.emit()"
        >
          <app-icon name="pencil" size="14" /> {{ 'budget.envelope.editAction' | transloco }}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:border-ib-red/40 hover:bg-ib-red/10 hover:text-ib-red"
          [attr.aria-label]="'budget.envelope.deleteAria' | transloco: { name: envelope().name }"
          (click)="remove.emit()"
        >
          <app-icon name="trash" size="14" /> {{ 'budget.envelope.deleteAction' | transloco }}
        </button>
      </div>
    </article>
  `,
})
export class EnvelopeCard {
  readonly envelope = input.required<Envelope>();
  readonly entries = input<HistoryEntry[]>([]);
  readonly member = input<MemberDisplay | null>(null);
  readonly credit = output<void>();
  readonly edit = output<void>();
  readonly remove = output<void>();
  readonly history = output<void>();

  protected readonly recentEntries = computed(() => this.entries().slice(0, 3));
}
