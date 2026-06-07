import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Icon, type IconName } from '@shared/components/icon/icon';
import { AreaChart, type AreaChartPoint } from '@shared/components/charts/area-chart';
import { DonutChart, type DonutSlice } from '@shared/components/charts/donut-chart';
import { BarChart, type BarGroup } from '@shared/components/charts/bar-chart';
import { salaryArchiveRemaining } from '@features/budget/domain/salary-archive-remaining';
import { SalaryArchiveGateway } from '@features/budget/domain/gateways/salary-archive.gateway';
import { RecurringEntryGateway } from '@features/budget/domain/gateways/recurring-entry.gateway';
import { EnvelopeGateway } from '@features/budget/domain/gateways/envelope.gateway';
import { LoanGateway } from '@features/budget/domain/gateways/loan.gateway';
import { normalizeCategory } from '@features/budget/domain/categories';

type Forecast = {
  readonly label: string;
  readonly icon: IconName;
  readonly color: string;
  readonly message: string;
  readonly detail: string;
  readonly type: 'envelope' | 'loan' | 'balance';
};

@Component({
  selector: 'app-budget-analytics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, Icon, AreaChart, DonutChart, BarChart, TranslocoPipe],
  host: { class: 'block space-y-6' },
  template: `
    <header>
      <h2 class="text-2xl font-bold text-text-primary">
        {{ 'budget.analytics.title' | transloco }}
      </h2>
      <p class="mt-1 text-sm text-text-muted">{{ 'budget.analytics.subtitle' | transloco }}</p>
    </header>

    <section
      class="grid grid-cols-2 lg:grid-cols-4 gap-4"
      [attr.aria-label]="'budget.analytics.kpiAriaLabel' | transloco"
    >
      @for (kpi of kpis(); track kpi.label) {
        <div class="rounded-xl border border-border bg-surface p-4">
          <div class="flex items-center gap-2 mb-2">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg" [class]="kpi.iconBg">
              <app-icon [name]="kpi.icon" size="16" [class]="kpi.iconColor" />
            </div>
            <span class="text-[11px] text-text-muted uppercase tracking-wider">{{
              kpi.label
            }}</span>
          </div>
          <p class="text-xl font-mono font-bold" [class]="kpi.valueColor">
            {{ kpi.value | number: '1.0-0' }}<span class="text-sm ml-0.5">&euro;</span>
          </p>
          @if (kpi.sub) {
            <p class="text-[10px] text-text-muted mt-1">{{ kpi.sub }}</p>
          }
        </div>
      }
    </section>

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

    <section class="rounded-xl border border-border bg-surface overflow-hidden">
      <div class="flex items-center gap-2 px-5 py-3 bg-ib-purple/5 border-b border-border/50">
        <app-icon name="trending-up" size="16" class="text-ib-purple" />
        <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ib-purple">
          {{ 'budget.analytics.forecastsTitle' | transloco }}
        </h3>
      </div>
      @if (forecasts().length > 0) {
        <div class="divide-y divide-border/30">
          @for (f of forecasts(); track f.label) {
            <div class="flex items-start gap-4 px-5 py-4 hover:bg-hover/30 transition-colors">
              <div
                class="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                [style.background-color]="f.color + '15'"
              >
                <app-icon [name]="f.icon" size="18" [style.color]="f.color" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-text-primary">{{ f.label }}</p>
                <p class="text-sm text-text-muted mt-0.5">{{ f.message }}</p>
                <p class="text-[11px] text-text-muted mt-1">{{ f.detail }}</p>
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="text-center py-12">
          <app-icon name="trending-up" size="32" class="text-text-muted/20 mx-auto mb-2" />
          <p class="text-sm text-text-muted">{{ 'budget.analytics.forecastsEmpty' | transloco }}</p>
          <p class="text-xs text-text-muted mt-1">
            {{ 'budget.analytics.forecastsEmptyHint' | transloco }}
          </p>
        </div>
      }
    </section>
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

  private readonly monthlyIncome = computed(() =>
    this.entries()
      .filter((e) => e.type === 'income')
      .reduce((s, e) => s + Number(e.amount), 0),
  );

  private readonly monthlyExpenses = computed(() =>
    this.entries()
      .filter((e) => e.type === 'expense')
      .reduce((s, e) => s + Number(e.amount), 0),
  );

  private readonly monthlyAnnual = computed(
    () =>
      this.entries()
        .filter((e) => e.type === 'annual_expense')
        .reduce((s, e) => s + Number(e.amount), 0) / 12,
  );

  private readonly monthlySpendings = computed(() =>
    this.entries()
      .filter((e) => e.type === 'spending')
      .reduce((s, e) => s + Number(e.amount), 0),
  );

  private readonly monthlyEnvelopeCredits = computed(() =>
    this.entries()
      .filter((e) => e.type === 'spending' && normalizeCategory(e.category).key === 'envelope')
      .reduce((s, e) => s + Number(e.amount), 0),
  );

  private readonly monthlyLoanPayments = computed(() =>
    this.entries()
      .filter((e) => e.type === 'spending' && normalizeCategory(e.category).key === 'repayment')
      .reduce((s, e) => s + Number(e.amount), 0),
  );

  private readonly totalEnvelopeBalance = computed(() =>
    this.envelopes().reduce((s, e) => s + Number(e.balance), 0),
  );

  protected readonly kpis = computed(() => {
    const income = this.monthlyIncome();
    const expenses = this.monthlyExpenses();
    const annual = this.monthlyAnnual();
    const spendings = this.monthlySpendings();
    const totalCharges = expenses + annual + spendings;
    const net = income - totalCharges;

    const envCredits = this.monthlyEnvelopeCredits();
    const loanPay = this.monthlyLoanPayments();
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

  protected readonly balanceHistory = computed<AreaChartPoint[]>(() => {
    const arch = this.archives().slice(-12);
    return arch.map((a) => ({
      label: this.formatMonth(a.month),
      value: salaryArchiveRemaining(a),
    }));
  });

  protected readonly expenseByCategory = computed<DonutSlice[]>(() => {
    const expenses = this.entries().filter(
      (e) => e.type === 'expense' || e.type === 'annual_expense',
    );
    // Regroupe par catégorie NORMALISÉE (clé) : « Alimentation » et « alimentation » fusionnent.
    const byKey = new Map<string, { i18nKey: string; color: string; value: number }>();

    for (const e of expenses) {
      const category = normalizeCategory(e.category);
      const amount = e.type === 'annual_expense' ? Number(e.amount) / 12 : Number(e.amount);
      const acc = byKey.get(category.key);
      if (acc) acc.value += amount;
      else
        byKey.set(category.key, {
          i18nKey: category.i18nKey,
          color: category.color,
          value: amount,
        });
    }

    return [...byKey.values()]
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
      .map(({ i18nKey, color, value }) => ({ label: this._i18n.translate(i18nKey), value, color }));
  });

  protected readonly totalExpensesLabel = computed(() => {
    const total = this.expenseByCategory().reduce((s, d) => s + d.value, 0);
    return total >= 1000 ? `${(total / 1000).toFixed(1)}k€` : `${total.toFixed(0)}€`;
  });

  protected readonly incomeVsExpenses = computed<BarGroup[]>(() => {
    const arch = this.archives().slice(-6);
    return arch.map((a) => ({
      label: this.formatMonth(a.month),
      bars: [
        { value: Number(a.salary), color: 'var(--color-ib-green)' },
        { value: Number(a.totalExpenses) + Number(a.totalSpendings), color: 'var(--color-ib-red)' },
      ],
    }));
  });

  protected readonly envelopeForecastChart = computed<AreaChartPoint[]>(() => {
    const envs = this.envelopes().filter((e) => e.target && Number(e.target) > 0);
    if (envs.length === 0) return [];

    const envCredits = this.monthlyEnvelopeCredits();
    const totalBalance = envs.reduce((s, e) => s + Number(e.balance), 0);
    const totalTarget = envs.reduce((s, e) => s + Number(e.target ?? 0), 0);
    const monthlyContrib = envCredits > 0 ? envCredits : (totalTarget - totalBalance) / 12;

    const now = new Date();
    const points: AreaChartPoint[] = [
      { label: this._i18n.translate('budget.analytics.todayLabel'), value: totalBalance },
    ];

    for (let i = 1; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const projected = Math.min(totalBalance + monthlyContrib * i, totalTarget);
      points.push({
        label: this._i18n.translate(`budget.analytics.monthShort.${d.getMonth() + 1}`),
        value: projected,
      });
    }

    return points;
  });

  protected readonly forecasts = computed<Forecast[]>(() => {
    const results: Forecast[] = [];
    const income = this.monthlyIncome();
    const totalCharges = this.monthlyExpenses() + this.monthlyAnnual() + this.monthlySpendings();
    const net = income - totalCharges;
    const envCredits = this.monthlyEnvelopeCredits();
    const loanPay = this.monthlyLoanPayments();

    if (net > 0) {
      results.push({
        label: this._i18n.translate('budget.analytics.forecast.remainingTitle'),
        icon: 'trending-up',
        color: 'var(--color-ib-green)',
        message: this._i18n.translate('budget.analytics.forecast.remainingMessage', {
          net: net.toFixed(0),
        }),
        detail: this._i18n.translate('budget.analytics.forecast.remainingDetail', {
          half: (net * 6).toFixed(0),
          year: (net * 12).toFixed(0),
        }),
        type: 'balance',
      });
    } else if (net < 0) {
      results.push({
        label: this._i18n.translate('budget.analytics.forecast.deficitTitle'),
        icon: 'alert-triangle',
        color: 'var(--color-ib-red)',
        message: this._i18n.translate('budget.analytics.forecast.deficitMessage', {
          amount: Math.abs(net).toFixed(0),
        }),
        detail: this._i18n.translate('budget.analytics.forecast.deficitDetail', {
          amount: Math.abs(net).toFixed(0),
        }),
        type: 'balance',
      });
    }

    const envsWithTarget = this.envelopes().filter((e) => Number(e.target ?? 0) > 0);
    for (const env of this.envelopes()) {
      const envBalance = Number(env.balance);
      const envTarget = Number(env.target ?? 0);
      if (!envTarget || envTarget <= 0 || envBalance >= envTarget) continue;

      const remaining = envTarget - envBalance;
      const monthlyContrib = envCredits > 0 ? envCredits / Math.max(envsWithTarget.length, 1) : 0;

      if (monthlyContrib > 0) {
        const months = Math.ceil(remaining / monthlyContrib);
        const targetDate = new Date();
        targetDate.setMonth(targetDate.getMonth() + months);
        const targetLabel = `${this._i18n.translate(`budget.analytics.monthShort.${targetDate.getMonth() + 1}`)} ${targetDate.getFullYear()}`;

        results.push({
          label: this._i18n.translate('budget.analytics.forecast.envelopeLabel', {
            name: env.name,
          }),
          icon: 'wallet',
          color: env.color || 'var(--color-ib-cyan)',
          message:
            months <= 1
              ? this._i18n.translate('budget.analytics.forecast.envelopeNextMonth')
              : this._i18n.translate('budget.analytics.forecast.envelopeIn', {
                  months,
                  date: targetLabel,
                }),
          detail: this._i18n.translate('budget.analytics.forecast.envelopeDetail', {
            balance: envBalance.toFixed(0),
            target: envTarget.toFixed(0),
            remaining: remaining.toFixed(0),
            contrib: monthlyContrib.toFixed(0),
          }),
          type: 'envelope',
        });
      } else {
        results.push({
          label: this._i18n.translate('budget.analytics.forecast.envelopeLabel', {
            name: env.name,
          }),
          icon: 'wallet',
          color: env.color || 'var(--color-ib-cyan)',
          message: this._i18n.translate('budget.analytics.forecast.envelopeNoContrib', {
            remaining: remaining.toFixed(0),
          }),
          detail: this._i18n.translate('budget.analytics.forecast.envelopeNoContribDetail', {
            balance: envBalance.toFixed(0),
            target: envTarget.toFixed(0),
          }),
          type: 'envelope',
        });
      }
    }

    const activeLoans = this.loans().filter((l) => Number(l.remaining) > 0);
    for (const loan of this.loans()) {
      const loanAmount = Number(loan.amount);
      const loanRemaining = Number(loan.remaining);
      if (loanRemaining <= 0) continue;

      const repaid = loanAmount - loanRemaining;
      const pct = loanAmount > 0 ? (repaid / loanAmount) * 100 : 0;

      const monthlyPayment = loanPay > 0 ? loanPay / Math.max(activeLoans.length, 1) : 0;

      const prefix = this._i18n.translate(
        loan.direction === 'lent'
          ? 'budget.analytics.forecast.loanPrefixLent'
          : 'budget.analytics.forecast.loanPrefixBorrowed',
      );
      const label = this._i18n.translate('budget.analytics.forecast.loanLabel', {
        prefix,
        person: loan.person,
      });

      if (monthlyPayment > 0) {
        const months = Math.ceil(loanRemaining / monthlyPayment);
        const clearDate = new Date();
        clearDate.setMonth(clearDate.getMonth() + months);
        const clearLabel = `${this._i18n.translate(`budget.analytics.monthShort.${clearDate.getMonth() + 1}`)} ${clearDate.getFullYear()}`;

        results.push({
          label,
          icon: loan.direction === 'lent' ? 'arrow-up-right' : 'arrow-down-left',
          color: loan.direction === 'lent' ? 'var(--color-ib-blue)' : 'var(--color-ib-orange)',
          message:
            months <= 1
              ? this._i18n.translate('budget.analytics.forecast.loanNextMonth')
              : this._i18n.translate('budget.analytics.forecast.loanIn', {
                  months,
                  date: clearLabel,
                }),
          detail: this._i18n.translate('budget.analytics.forecast.loanDetail', {
            pct: pct.toFixed(0),
            remaining: loanRemaining.toFixed(0),
            payment: monthlyPayment.toFixed(0),
          }),
          type: 'loan',
        });
      } else {
        results.push({
          label,
          icon: loan.direction === 'lent' ? 'arrow-up-right' : 'arrow-down-left',
          color: loan.direction === 'lent' ? 'var(--color-ib-blue)' : 'var(--color-ib-orange)',
          message: this._i18n.translate('budget.analytics.forecast.loanNoPayment', {
            remaining: loanRemaining.toFixed(0),
          }),
          detail: this._i18n.translate('budget.analytics.forecast.loanNoPaymentDetail', {
            pct: pct.toFixed(0),
          }),
          type: 'loan',
        });
      }
    }

    return results;
  });
}
