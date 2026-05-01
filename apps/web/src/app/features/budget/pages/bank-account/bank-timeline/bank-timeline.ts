import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Icon } from '@shared/components/icon/icon';
import { RecurringEntryType } from '../../../domain/models/recurring-entry.model';

export type BankTimelineEvent = {
  id: string;
  day: number;
  label: string;
  amount: number;
  sign: string;
  type: RecurringEntryType;
  passed: boolean;
};

@Component({
  selector: 'app-bank-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, Icon],
  host: { class: 'block' },
  template: `
    @if (timelineEvents().length > 0) {
      <section class="rounded-xl border border-border bg-surface overflow-hidden">
        <div class="flex items-center gap-2 px-5 py-3 bg-ib-blue/5 border-b border-border/50">
          <app-icon name="calendar" size="16" class="text-ib-blue" />
          <h3 class="text-xs font-semibold uppercase tracking-wider text-ib-blue">Timeline du mois</h3>
        </div>
        <div class="px-5 py-4">
          <div class="relative">
            <!-- Ligne verticale -->
            <div class="absolute left-3.5 top-0 bottom-0 w-px bg-border"></div>
            <div class="space-y-0.5">
              @for (event of timelineEvents(); track event.id) {
                <div class="relative flex items-center gap-3 py-1.5 pl-9">
                  <!-- Point sur la ligne -->
                  <div class="absolute left-2 h-3 w-3 rounded-full border-2 border-surface"
                       [class.bg-ib-green]="event.type === 'income'"
                       [class.bg-ib-red]="event.type === 'expense'"
                       [class.bg-ib-orange]="event.type === 'annual_expense'"
                       [class.bg-ib-purple]="event.type === 'transfer'"
                       [class.bg-ib-yellow]="event.type === 'spending'"
                       [class.ring-2]="event.day === currentDay()"
                       [class.ring-ib-cyan]="event.day === currentDay()"></div>
                  <!-- Jour -->
                  <span class="text-[11px] font-mono font-bold w-5 shrink-0"
                        [class.text-ib-cyan]="event.day === currentDay()"
                        [class.text-text-muted]="event.day !== currentDay()">
                    {{ event.day }}
                  </span>
                  <!-- Label -->
                  <span class="text-[13px] truncate flex-1"
                        [class.text-text-muted]="event.passed"
                        [class.line-through]="event.passed"
                        [class.text-text-primary]="!event.passed">
                    {{ event.label }}
                  </span>
                  <!-- Montant -->
                  <span class="text-[13px] font-mono font-bold shrink-0"
                        [class.text-ib-green]="event.type === 'income'"
                        [class.text-ib-red]="event.type === 'expense'"
                        [class.text-ib-orange]="event.type === 'annual_expense'"
                        [class.text-ib-purple]="event.type === 'transfer'"
                        [class.text-ib-yellow]="event.type === 'spending'"
                        [class.opacity-50]="event.passed">
                    {{ event.sign }}{{ event.amount | number:'1.2-2' }}&euro;
                  </span>
                </div>
              }
            </div>
            <!-- Marqueur "Aujourd'hui" -->
            <div class="relative flex items-center gap-3 py-1.5 pl-9 mt-1">
              <div class="absolute left-1.5 h-4 w-4 rounded-full bg-ib-cyan/20 border-2 border-ib-cyan"></div>
              <span class="text-[11px] font-mono font-bold w-5 text-ib-cyan shrink-0">{{ currentDay() }}</span>
              <span class="text-[11px] font-semibold text-ib-cyan uppercase tracking-wider">Aujourd'hui</span>
              <span class="text-[13px] font-mono font-bold text-ib-cyan shrink-0">{{ currentBalance() | number:'1.2-2' }}&euro;</span>
            </div>
          </div>
        </div>
      </section>
    }
  `,
})
export class BankTimeline {
  readonly timelineEvents = input.required<BankTimelineEvent[]>();
  readonly currentDay = input.required<number>();
  readonly currentBalance = input.required<number>();
}
