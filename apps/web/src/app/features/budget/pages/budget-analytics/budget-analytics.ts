import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Icon, type IconName } from '@shared/components/icon/icon';
import { AreaChart, type AreaChartPoint } from '@shared/components/charts/area-chart';
import { DonutChart, type DonutSlice } from '@shared/components/charts/donut-chart';
import { BarChart, type BarGroup } from '@shared/components/charts/bar-chart';
import { SalaryArchiveGateway } from '@features/budget/domain/gateways/salary-archive.gateway';
import { RecurringEntryGateway } from '@features/budget/domain/gateways/recurring-entry.gateway';
import { EnvelopeGateway } from '@features/budget/domain/gateways/envelope.gateway';
import { LoanGateway } from '@features/budget/domain/gateways/loan.gateway';
import { monthlyBreakdown } from '@features/budget/domain/analytics-monthly';
import {
  balanceHistorySeries,
  incomeVsExpensesSeries,
  expenseCategoryBreakdown,
  envelopeForecastSeries,
} from '@features/budget/domain/analytics-charts';
import { buildForecasts, type ForecastResult } from '@features/budget/domain/analytics-forecasts';
import { AnalyticsKpiGrid, type KpiCard } from './analytics-kpi-grid/analytics-kpi-grid';
import {
  AnalyticsForecastList,
  type ForecastView,
} from './analytics-forecast-list/analytics-forecast-list';

@Component({
  selector: 'app-budget-analytics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Icon,
    AreaChart,
    DonutChart,
    BarChart,
    TranslocoPipe,
    AnalyticsKpiGrid,
    AnalyticsForecastList,
  ],
  host: { class: 'block space-y-6' },
  template: `
    <header>
      <h2 class="text-2xl font-bold text-text-primary">
        {{ 'budget.analytics.title' | transloco }}
      </h2>
      <p class="mt-1 text-sm text-text-muted">{{ 'budget.analytics.subtitle' | transloco }}</p>
    </header>

    <app-analytics-kpi-grid
      [kpis]="kpis()"
      [ariaLabel]="'budget.analytics.kpiAriaLabel' | transloco"
    />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section class="rounded-xl border border-border bg-surface overflow-hidden">
        <div class="flex items-center gap-2 px-5 py-3 bg-ib-green/5 border-b border-border/50">
          <app-icon name="trending-up" size="16" class="text-ib-green" />
          <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ib-green">
            {{ 'budget.analytics.balanceHistoryTitle' | transloco }}
          </h3>
        </div>
        <div class="p-4 h-52">
          @if (balanceHistory().length > 1) {
            <app-area-chart [data]="balanceHistory()" color="var(--color-ib-green)" />
          } @else {
            <div class="flex items-center justify-center h-full text-sm text-text-muted">
              {{ 'budget.analytics.balanceHistoryEmpty' | transloco }}
            </div>
          }
        </div>
      </section>

      <section class="rounded-xl border border-border bg-surface overflow-hidden">
        <div class="flex items-center gap-2 px-5 py-3 bg-ib-red/5 border-b border-border/50">
          <app-icon name="receipt" size="16" class="text-ib-red" />
          <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ib-red">
            {{ 'budget.analytics.expenseDistributionTitle' | transloco }}
          </h3>
        </div>
        <div class="p-5">
          @if (expenseByCategory().length > 0) {
            <app-donut-chart
              [data]="expenseByCategory()"
              [centerLabel]="totalExpensesLabel()"
              [centerSub]="'budget.analytics.perMonth' | transloco"
            />
          } @else {
            <div class="flex items-center justify-center h-32 text-sm text-text-muted">
              {{ 'budget.analytics.expenseDistributionEmpty' | transloco }}
            </div>
          }
        </div>
      </section>

      <section class="rounded-xl border border-border bg-surface overflow-hidden">
        <div class="flex items-center gap-2 px-5 py-3 bg-ib-blue/5 border-b border-border/50">
          <app-icon name="banknote" size="16" class="text-ib-blue" />
          <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ib-blue">
            {{ 'budget.analytics.incomeVsExpensesTitle' | transloco }}
          </h3>
        </div>
        <div class="p-4 h-52">
          @if (incomeVsExpenses().length > 0) {
            <app-bar-chart [data]="incomeVsExpenses()" />
          } @else {
            <div class="flex items-center justify-center h-full text-sm text-text-muted">
              {{ 'budget.analytics.incomeVsExpensesEmpty' | transloco }}
            </div>
          }
        </div>
        <div class="flex items-center justify-center gap-6 pb-3 text-[10px] text-text-muted">
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-sm bg-ib-green"></span>
            {{ 'budget.analytics.income' | transloco }}
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-sm bg-ib-red"></span>
            {{ 'budget.analytics.expenses' | transloco }}
          </span>
        </div>
      </section>

      <section class="rounded-xl border border-border bg-surface overflow-hidden">
        <div class="flex items-center gap-2 px-5 py-3 bg-ib-cyan/5 border-b border-border/50">
          <app-icon name="trending-up" size="16" class="text-ib-cyan" />
          <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ib-cyan">
            {{ 'budget.analytics.envelopeForecastTitle' | transloco }}
          </h3>
        </div>
        <div class="p-4 h-52">
          @if (envelopeForecastChart().length > 1) {
            <app-area-chart [data]="envelopeForecastChart()" color="var(--color-ib-cyan)" />
          } @else {
            <div class="flex items-center justify-center h-full text-sm text-text-muted">
              {{ 'budget.analytics.envelopeForecastEmpty' | transloco }}
            </div>
          }
        </div>
      </section>
    </div>

    <app-analytics-forecast-list
      [forecasts]="forecasts()"
      [title]="'budget.analytics.forecastsTitle' | transloco"
      [emptyText]="'budget.analytics.forecastsEmpty' | transloco"
      [emptyHint]="'budget.analytics.forecastsEmptyHint' | transloco"
    />
  `,
})
export class BudgetAnalytics {
  private readonly getArchives = inject(SalaryArchiveGateway);
  private readonly getEntries = inject(RecurringEntryGateway);
  private readonly getEnvelopes = inject(EnvelopeGateway);
  private readonly getLoans = inject(LoanGateway);
  private readonly _i18n = inject(TranslocoService);

  private formatMonth(m: string): string {
    const [y, mo] = m.split('-');
    const monthName = this._i18n.translate(`budget.analytics.monthShort.${Number(mo)}`);
    return `${monthName} ${y.slice(2)}`;
  }

  private readonly allData = toSignal(
    forkJoin({
      archives: this.getArchives.getAll(),
      entries: this.getEntries.getAll(),
      envelopes: this.getEnvelopes.getAll(),
      loans: this.getLoans.getAll(),
    }),
    { initialValue: { archives: [], entries: [], envelopes: [], loans: [] } },
  );

  private readonly archives = computed(() =>
    [...this.allData().archives].sort((a, b) => a.month.localeCompare(b.month)),
  );

  private readonly entries = computed(() => this.allData().entries);
  private readonly envelopes = computed(() => this.allData().envelopes);
  private readonly loans = computed(() => this.allData().loans);

  protected readonly currentMonth = computed(() => new Date().toISOString().slice(0, 7));
  private readonly breakdown = computed(() =>
    monthlyBreakdown(this.entries(), this.currentMonth()),
  );
  private readonly totalEnvelopeBalance = computed(() =>
    this.envelopes().reduce((s, e) => s + Number(e.balance), 0),
  );

  protected readonly kpis = computed<KpiCard[]>(() => {
    const income = this.breakdown().income;
    const annual = this.breakdown().annualMonthly;
    const spendings = this.breakdown().spendings;
    const totalCharges = this.breakdown().totalCharges;
    const net = this.breakdown().net;

    const envCredits = this.breakdown().envelopeCredits;
    const loanPay = this.breakdown().loanPayments;
    const otherSpendings = spendings - envCredits - loanPay;

    const chargeParts: string[] = [];
    if (annual > 0)
      chargeParts.push(
        this._i18n.translate('budget.analytics.kpi.annualizedShare', { value: annual.toFixed(0) }),
      );
    if (envCredits > 0)
      chargeParts.push(
        this._i18n.translate('budget.analytics.kpi.envelopesShare', {
          value: envCredits.toFixed(0),
        }),
      );
    if (loanPay > 0)
      chargeParts.push(
        this._i18n.translate('budget.analytics.kpi.loansShare', { value: loanPay.toFixed(0) }),
      );
    if (otherSpendings > 0)
      chargeParts.push(
        this._i18n.translate('budget.analytics.kpi.otherShare', {
          value: otherSpendings.toFixed(0),
        }),
      );

    return [
      {
        label: this._i18n.translate('budget.analytics.kpi.monthlyIncome'),
        icon: 'trending-up' as const,
        iconBg: 'bg-ib-green/10',
        iconColor: 'text-ib-green',
        value: income,
        valueColor: 'text-ib-green',
        sub: null,
      },
      {
        label: this._i18n.translate('budget.analytics.kpi.totalCharges'),
        icon: 'receipt' as const,
        iconBg: 'bg-ib-red/10',
        iconColor: 'text-ib-red',
        value: totalCharges,
        valueColor: 'text-ib-red',
        sub:
          chargeParts.length > 0
            ? this._i18n.translate('budget.analytics.kpi.chargesDetail', {
                detail: chargeParts.join(', '),
              })
            : null,
      },
      {
        label: this._i18n.translate('budget.analytics.kpi.disposable'),
        icon: 'wallet' as const,
        iconBg: net >= 0 ? 'bg-ib-green/10' : 'bg-ib-red/10',
        iconColor: net >= 0 ? 'text-ib-green' : 'text-ib-red',
        value: net,
        valueColor: net >= 0 ? 'text-ib-green' : 'text-ib-red',
        sub:
          net > 0
            ? this._i18n.translate('budget.analytics.kpi.savingsCapacity')
            : this._i18n.translate('budget.analytics.kpi.monthlyDeficit'),
      },
      {
        label: this._i18n.translate('budget.analytics.kpi.totalSavings'),
        icon: 'mail' as const,
        iconBg: 'bg-ib-cyan/10',
        iconColor: 'text-ib-cyan',
        value: this.totalEnvelopeBalance(),
        valueColor: 'text-ib-cyan',
        sub: this._i18n.translate('budget.analytics.kpi.envelopesCount', {
          count: this.envelopes().length,
        }),
      },
    ];
  });

  protected readonly balanceHistory = computed<AreaChartPoint[]>(() =>
    balanceHistorySeries(this.archives()).map((p) => ({
      label: this.formatMonth(p.month),
      value: p.value,
    })),
  );

  protected readonly incomeVsExpenses = computed<BarGroup[]>(() =>
    incomeVsExpensesSeries(this.archives()).map((p) => ({
      label: this.formatMonth(p.month),
      bars: [
        { value: p.salary, color: 'var(--color-ib-green)' },
        { value: p.charges, color: 'var(--color-ib-red)' },
      ],
    })),
  );

  protected readonly expenseByCategory = computed<DonutSlice[]>(() =>
    expenseCategoryBreakdown(this.entries(), this.currentMonth()).map((d) => ({
      label: this._i18n.translate(d.i18nKey),
      value: d.value,
      color: d.color,
    })),
  );

  protected readonly totalExpensesLabel = computed(() => {
    const total = this.expenseByCategory().reduce((s, d) => s + d.value, 0);
    return total >= 1000 ? `${(total / 1000).toFixed(1)}k€` : `${total.toFixed(0)}€`;
  });

  protected readonly envelopeForecastChart = computed<AreaChartPoint[]>(() => {
    const now = new Date();
    return envelopeForecastSeries(this.envelopes(), this.breakdown().envelopeCredits, { now }).map(
      (p) => ({
        label:
          p.monthOffset === 0
            ? this._i18n.translate('budget.analytics.todayLabel')
            : this._i18n.translate(
                `budget.analytics.monthShort.${new Date(now.getFullYear(), now.getMonth() + p.monthOffset, 1).getMonth() + 1}`,
              ),
        value: p.value,
      }),
    );
  });

  private readonly forecastResults = computed<ForecastResult[]>(() =>
    buildForecasts({
      net: this.breakdown().net,
      envelopes: this.envelopes(),
      loans: this.loans(),
      envelopeCredits: this.breakdown().envelopeCredits,
      loanPayments: this.breakdown().loanPayments,
    }),
  );

  protected readonly forecasts = computed<ForecastView[]>(() =>
    this.forecastResults().map((r) => this.toForecastView(r)),
  );

  private toForecastView(r: ForecastResult): ForecastView {
    switch (r.kind) {
      case 'surplus':
        return {
          label: this._i18n.translate('budget.analytics.forecast.remainingTitle'),
          icon: 'trending-up',
          color: 'var(--color-ib-green)',
          message: this._i18n.translate('budget.analytics.forecast.remainingMessage', {
            net: r.net.toFixed(0),
          }),
          detail: this._i18n.translate('budget.analytics.forecast.remainingDetail', {
            half: (r.net * 6).toFixed(0),
            year: (r.net * 12).toFixed(0),
          }),
        };
      case 'deficit':
        return {
          label: this._i18n.translate('budget.analytics.forecast.deficitTitle'),
          icon: 'alert-triangle',
          color: 'var(--color-ib-red)',
          message: this._i18n.translate('budget.analytics.forecast.deficitMessage', {
            amount: Math.abs(r.net).toFixed(0),
          }),
          detail: this._i18n.translate('budget.analytics.forecast.deficitDetail', {
            amount: Math.abs(r.net).toFixed(0),
          }),
        };
      case 'envelope':
        return this.envelopeForecastView(r);
      case 'loan':
        return this.loanForecastView(r);
    }
  }

  private envelopeForecastView(r: Extract<ForecastResult, { kind: 'envelope' }>): ForecastView {
    if (r.monthsToTarget !== null) {
      const targetDate = new Date();
      targetDate.setMonth(targetDate.getMonth() + r.monthsToTarget);
      const targetLabel = `${this._i18n.translate(`budget.analytics.monthShort.${targetDate.getMonth() + 1}`)} ${targetDate.getFullYear()}`;
      return {
        label: this._i18n.translate('budget.analytics.forecast.envelopeLabel', {
          name: r.name,
        }),
        icon: 'wallet',
        color: r.color,
        message:
          r.monthsToTarget <= 1
            ? this._i18n.translate('budget.analytics.forecast.envelopeNextMonth')
            : this._i18n.translate('budget.analytics.forecast.envelopeIn', {
                months: r.monthsToTarget,
                date: targetLabel,
              }),
        detail: this._i18n.translate('budget.analytics.forecast.envelopeDetail', {
          balance: r.balance.toFixed(0),
          target: r.target.toFixed(0),
          remaining: r.remaining.toFixed(0),
          contrib: r.contrib.toFixed(0),
        }),
      };
    }
    return {
      label: this._i18n.translate('budget.analytics.forecast.envelopeLabel', {
        name: r.name,
      }),
      icon: 'wallet',
      color: r.color,
      message: this._i18n.translate('budget.analytics.forecast.envelopeNoContrib', {
        remaining: r.remaining.toFixed(0),
      }),
      detail: this._i18n.translate('budget.analytics.forecast.envelopeNoContribDetail', {
        balance: r.balance.toFixed(0),
        target: r.target.toFixed(0),
      }),
    };
  }

  private loanForecastView(r: Extract<ForecastResult, { kind: 'loan' }>): ForecastView {
    const prefix = this._i18n.translate(
      r.direction === 'lent'
        ? 'budget.analytics.forecast.loanPrefixLent'
        : 'budget.analytics.forecast.loanPrefixBorrowed',
    );
    const label = this._i18n.translate('budget.analytics.forecast.loanLabel', {
      prefix,
      person: r.person,
    });
    const icon: IconName = r.direction === 'lent' ? 'arrow-up-right' : 'arrow-down-left';

    if (r.monthsToClear !== null) {
      const clearDate = new Date();
      clearDate.setMonth(clearDate.getMonth() + r.monthsToClear);
      const clearLabel = `${this._i18n.translate(`budget.analytics.monthShort.${clearDate.getMonth() + 1}`)} ${clearDate.getFullYear()}`;
      return {
        label,
        icon,
        color: r.color,
        message:
          r.monthsToClear <= 1
            ? this._i18n.translate('budget.analytics.forecast.loanNextMonth')
            : this._i18n.translate('budget.analytics.forecast.loanIn', {
                months: r.monthsToClear,
                date: clearLabel,
              }),
        detail: this._i18n.translate('budget.analytics.forecast.loanDetail', {
          pct: r.pct.toFixed(0),
          remaining: r.remaining.toFixed(0),
          payment: r.payment.toFixed(0),
        }),
      };
    }
    return {
      label,
      icon,
      color: r.color,
      message: this._i18n.translate('budget.analytics.forecast.loanNoPayment', {
        remaining: r.remaining.toFixed(0),
      }),
      detail: this._i18n.translate('budget.analytics.forecast.loanNoPaymentDetail', {
        pct: r.pct.toFixed(0),
      }),
    };
  }
}
