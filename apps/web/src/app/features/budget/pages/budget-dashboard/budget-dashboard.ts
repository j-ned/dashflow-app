import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Icon } from '@shared/components/icon/icon';
import { MemberLoanList } from '../../components/member-loan-list/member-loan-list';
import { MemberManager } from '../../components/member-manager/member-manager';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { Observable, catchError, of, switchMap } from 'rxjs';
import { EnvelopeGateway } from '@features/budget/domain/gateways/envelope.gateway';
import { LoanGateway } from '@features/budget/domain/gateways/loan.gateway';
import { MemberGateway } from '@features/budget/domain/gateways/member.gateway';
import { RecurringEntryGateway } from '@features/budget/domain/gateways/recurring-entry.gateway';
import { MemberSummary, buildMemberSummaries } from '../../domain/member-summary';
import { MemberSummaryHeader } from './member-summary-header/member-summary-header';
import { MemberKpiGrid } from './member-kpi-grid/member-kpi-grid';
import { MemberUsageBar } from './member-usage-bar/member-usage-bar';
import { MemberExpenseColumns } from './member-expense-columns/member-expense-columns';
import { MemberEnvelopeGrid } from './member-envelope-grid/member-envelope-grid';

@Component({
  selector: 'app-budget-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Icon,
    MemberLoanList,
    MemberManager,
    TranslocoPipe,
    MemberSummaryHeader,
    MemberKpiGrid,
    MemberUsageBar,
    MemberExpenseColumns,
    MemberEnvelopeGrid,
  ],
  host: { class: 'block space-y-6' },
  template: `
    <header class="flex items-start justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">
          {{ 'budget.dashboard.title' | transloco }}
        </h2>
        <p class="mt-1 text-sm text-text-muted">{{ 'budget.dashboard.subtitle' | transloco }}</p>
      </div>
      <button
        type="button"
        class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-muted hover:bg-hover hover:text-text-primary transition-colors"
        (click)="memberManager().open()"
      >
        <app-icon name="users" size="16" /> {{ 'budget.members.manage' | transloco }}
      </button>
    </header>
    <app-member-manager #mm (changed)="reloadMembers()" />

    @for (ms of memberSummaries(); track ms.id) {
      <section class="rounded-xl border border-border bg-surface overflow-hidden">
        <app-member-summary-header [summary]="ms" />
        <div class="p-5 space-y-5">
          <app-member-kpi-grid [summary]="ms" />

          @if (
            ms.totalIncome > 0 &&
            ms.totalMonthlyExpenses + ms.monthlyAnnualExpenses + ms.totalSpendings > 0
          ) {
            <app-member-usage-bar [summary]="ms" />
          }

          @if (
            ms.monthlyExpenses.length > 0 || ms.annualExpenses.length > 0 || ms.spendings.length > 0
          ) {
            <app-member-expense-columns [summary]="ms" [dashRefCardHeight]="dashRefCardHeight()" />
          }

          @if (ms.envelopes.length > 0) {
            <app-member-envelope-grid [summary]="ms" />
          }

          @if (ms.lentLoans.length > 0) {
            <app-member-loan-list [loans]="ms.lentLoans" direction="lent" />
          }
          @if (ms.borrowedLoans.length > 0) {
            <app-member-loan-list [loans]="ms.borrowedLoans" direction="borrowed" />
          }
        </div>
      </section>
    }
  `,
})
export class BudgetDashboard {
  private readonly _el = inject(ElementRef);
  private readonly envelopeGateway = inject(EnvelopeGateway);
  private readonly loanGateway = inject(LoanGateway);
  private readonly memberGateway = inject(MemberGateway);
  private readonly recurringEntryGateway = inject(RecurringEntryGateway);
  private readonly _i18n = inject(TranslocoService);

  protected readonly dashRefCardHeight = signal<number | null>(null);

  constructor() {
    afterNextRender(() => {
      const host = this._el.nativeElement as HTMLElement;
      const tryObserve = () => {
        const el = host.querySelector('[data-dash-ref]');
        if (!el) return false;
        const ro = new ResizeObserver(([entry]) =>
          this.dashRefCardHeight.set(entry.borderBoxSize[0].blockSize),
        );
        ro.observe(el);
        return true;
      };
      if (!tryObserve()) {
        const mo = new MutationObserver(() => {
          if (tryObserve()) mo.disconnect();
        });
        mo.observe(host, { childList: true, subtree: true });
      }
    });
  }

  protected readonly memberManager = viewChild.required<MemberManager>('mm');
  private readonly _membersRefresh = signal(0);
  protected reloadMembers(): void {
    this._membersRefresh.update((v) => v + 1);
  }

  // Dégrade à liste vide sur erreur (ex. 403 d'une feature avancée non incluse dans le plan gratuit)
  // pour que le dashboard rende le budget de base sans planter.
  private orEmpty<T>(src: Observable<T[]>): Observable<T[]> {
    return src.pipe(catchError(() => of<T[]>([])));
  }

  protected readonly envelopes = toSignal(this.orEmpty(this.envelopeGateway.getAll()), {
    initialValue: [],
  });
  protected readonly loans = toSignal(this.orEmpty(this.loanGateway.getAll()), {
    initialValue: [],
  });
  protected readonly members = toSignal(
    toObservable(this._membersRefresh).pipe(switchMap(() => this.memberGateway.getAll())),
    { initialValue: [] },
  );
  protected readonly entries = toSignal(this.orEmpty(this.recurringEntryGateway.getAll()), {
    initialValue: [],
  });

  protected readonly memberSummaries = computed<MemberSummary[]>(() =>
    buildMemberSummaries(
      {
        envelopes: this.envelopes(),
        loans: this.loans(),
        members: this.members(),
        entries: this.entries(),
        globalLabel: this._i18n.translate('budget.dashboard.globalLabel'),
        globalInitials: this._i18n.translate('budget.dashboard.globalInitials'),
      },
      {
        currentMonth: new Date().toISOString().slice(0, 7),
        today: new Date().getDate(),
      },
    ),
  );
}
