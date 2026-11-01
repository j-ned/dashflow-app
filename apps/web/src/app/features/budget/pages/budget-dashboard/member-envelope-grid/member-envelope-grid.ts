import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';
import { MemberSummary } from '../../../domain/member-summary';

@Component({
  selector: 'app-member-envelope-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, RouterLink, TranslocoPipe, Icon],
  host: { class: 'block rounded-xl border border-border bg-surface overflow-hidden' },
  template: `
    <div class="flex items-center gap-2 px-4 py-2.5 bg-ib-cyan/5 border-b border-border/50">
      <app-icon name="wallet" size="14" class="text-ib-cyan" />
      <h4 class="text-[11px] font-semibold uppercase tracking-wider text-ib-cyan">
        {{ 'budget.dashboard.envelopes' | transloco }}
      </h4>
    </div>
    <div
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 divide-border/20"
    >
      @for (env of summary().envelopes; track env.id) {
        <a routerLink="/budget/envelopes" class="p-4 hover:bg-ib-cyan/3 transition-colors">
          <div class="flex items-center justify-between mb-1">
            <p class="text-sm font-medium text-text-primary truncate">{{ env.name }}</p>
            <span
              class="rounded-full px-1.5 py-0.5 text-[9px] font-medium shrink-0"
              [style.background-color]="env.color + '20'"
              [style.color]="env.color"
            >
              {{ env.type }}
            </span>
          </div>
          <p class="text-lg font-mono font-bold text-ib-cyan">
            {{ env.balance | number: '1.2-2' }}<span class="text-sm ml-0.5">&euro;</span>
          </p>
          @if (env.target) {
            @let pct = (env.balance / env.target) * 100;
            <div class="mt-2">
              <div class="flex justify-between text-[10px] text-text-muted mb-0.5">
                <span>{{ env.target | number: '1.0-0' }}&euro;</span>
                <span class="font-mono">{{ pct | number: '1.0-0' }}%</span>
              </div>
              <div class="h-1.5 rounded-full bg-hover overflow-hidden">
                <div
                  class="h-full rounded-full transition"
                  [style.width.%]="pct > 100 ? 100 : pct"
                  [style.background-color]="env.color"
                ></div>
              </div>
            </div>
          }
        </a>
      }
    </div>
  `,
})
export class MemberEnvelopeGrid {
  readonly summary = input.required<MemberSummary>();
}
