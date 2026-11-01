import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { MemberSummary } from '../../../domain/member-summary';

@Component({
  selector: 'app-member-summary-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  host: { class: 'flex items-center gap-3 px-5 py-4 border-b border-border/50 bg-raised/30' },
  template: `
    <div
      class="flex h-11 w-11 items-center justify-center rounded-full bg-ib-green/10 text-ib-green text-sm font-bold shrink-0 ring-2 ring-ib-green/20"
    >
      {{ summary().initials }}
    </div>
    <div>
      <h3 class="text-lg font-semibold text-text-primary">{{ summary().label }}</h3>
      <p class="text-[11px] text-text-muted">
        {{
          (summary().envelopes.length > 1
            ? 'budget.dashboard.envelopesCountPlural'
            : 'budget.dashboard.envelopesCount'
          ) | transloco: { count: summary().envelopes.length }
        }}
        ·
        {{
          (summary().lentLoans.length + summary().borrowedLoans.length > 1
            ? 'budget.dashboard.loansCountPlural'
            : 'budget.dashboard.loansCount'
          ) | transloco: { count: summary().lentLoans.length + summary().borrowedLoans.length }
        }}
        @if (summary().incomes.length > 0) {
          ·
          {{
            (summary().incomes.length > 1
              ? 'budget.dashboard.incomesCountPlural'
              : 'budget.dashboard.incomesCount'
            ) | transloco: { count: summary().incomes.length }
          }}
        }
      </p>
    </div>
  `,
})
export class MemberSummaryHeader {
  readonly summary = input.required<MemberSummary>();
}
