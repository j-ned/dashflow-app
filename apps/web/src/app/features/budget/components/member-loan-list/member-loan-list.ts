import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Loan, LoanDirection } from '../../domain/models/loan.model';
import { Icon, type IconName } from '@shared/components/icon/icon';

@Component({
  selector: 'app-member-loan-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DecimalPipe, Icon, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <div class="rounded-xl border border-border bg-surface overflow-hidden">
      <div
        class="flex items-center gap-2 px-4 py-2.5 border-b border-border/50"
        [class]="headerBg()"
      >
        <app-icon [name]="icon()" size="14" [class]="accentText()" />
        <h4 class="text-[11px] font-semibold uppercase tracking-wider" [class]="accentText()">
          {{ titleKey() | transloco }}
        </h4>
      </div>
      <div class="divide-y divide-border/20">
        @for (loan of loans(); track loan.id) {
          @let pct = loan.amount > 0 ? ((loan.amount - loan.remaining) / loan.amount) * 100 : 0;
          <a
            routerLink="/budget/loans"
            class="flex items-center justify-between px-4 py-3 transition-colors"
            [class]="hoverBg()"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div
                class="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold shrink-0"
                [class]="badgeClass()"
              >
                {{ pct | number: '1.0-0' }}%
              </div>
              <div class="min-w-0">
                <p class="text-sm font-medium text-text-primary truncate">{{ loan.person }}</p>
                <div class="h-1 w-24 rounded-full bg-hover mt-1 overflow-hidden">
                  <div
                    class="h-full rounded-full transition"
                    [class]="barClass()"
                    [style.width.%]="pct > 100 ? 100 : pct"
                  ></div>
                </div>
              </div>
            </div>
            <span class="shrink-0 text-right">
              <span class="block text-sm font-mono font-bold" [class]="amountClass()"
                >{{ loan.remaining | number: '1.2-2' }}<span class="text-xs">&euro;</span></span
              >
              <span class="block text-[9px] uppercase tracking-wide text-text-muted">{{
                captionKey() | transloco
              }}</span>
            </span>
          </a>
        }
      </div>
    </div>
  `,
})
export class MemberLoanList {
  readonly loans = input.required<readonly Loan[]>();
  readonly direction = input.required<LoanDirection>();

  private readonly lent = computed(() => this.direction() === 'lent');
  protected readonly icon = computed<IconName>(() =>
    this.lent() ? 'arrow-up-right' : 'arrow-down-left',
  );
  protected readonly titleKey = computed(() =>
    this.lent() ? 'budget.dashboard.loans' : 'budget.dashboard.debts',
  );
  protected readonly captionKey = computed(() =>
    this.lent() ? 'budget.dashboard.toReceive' : 'budget.dashboard.toRepay',
  );
  protected readonly accentText = computed(() => (this.lent() ? 'text-ib-blue' : 'text-ib-orange'));
  protected readonly headerBg = computed(() => (this.lent() ? 'bg-ib-blue/5' : 'bg-ib-orange/5'));
  protected readonly hoverBg = computed(() =>
    this.lent() ? 'hover:bg-ib-blue/3' : 'hover:bg-ib-orange/3',
  );
  protected readonly badgeClass = computed(() =>
    this.lent() ? 'bg-ib-blue/10 text-ib-blue' : 'bg-ib-orange/10 text-ib-orange',
  );
  protected readonly barClass = computed(() => (this.lent() ? 'bg-ib-blue' : 'bg-ib-orange'));
  protected readonly amountClass = computed(() => (this.lent() ? 'text-ib-blue' : 'text-ib-red'));
}
