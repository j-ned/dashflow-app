import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { Icon, type IconName } from '@shared/components/icon/icon';
import { AreaChart, type AreaChartPoint } from '@shared/components/charts/area-chart';
import { DonutChart, type DonutSlice } from '@shared/components/charts/donut-chart';
import { BarChart, type BarGroup } from '@shared/components/charts/bar-chart';
import { GetSalaryArchivesUseCase } from '../../domain/use-cases/get-salary-archives.use-case';
import { GetRecurringEntriesUseCase } from '../../domain/use-cases/get-recurring-entries.use-case';
import { GetEnvelopesUseCase } from '../../domain/use-cases/get-envelopes.use-case';
import { GetLoansUseCase } from '../../domain/use-cases/get-loans.use-case';

// ── Helpers ──

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

function formatMonth(m: string): string {
  const [y, mo] = m.split('-');
  return `${MONTH_LABELS[Number(mo) - 1]} ${y.slice(2)}`;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Logement': 'var(--color-ib-blue)',
  'Transport': 'var(--color-ib-cyan)',
  'Alimentation': 'var(--color-ib-green)',
  'Santé': 'var(--color-ib-red)',
  'Loisirs': 'var(--color-ib-purple)',
  'Abonnement': 'var(--color-ib-orange)',
  'Assurance': 'var(--color-ib-yellow)',
  'Enveloppe': 'var(--color-ib-cyan)',
  'Remboursement': 'var(--color-ib-pink)',
};

function categoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? 'var(--color-text-muted)';
}

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
  imports: [DecimalPipe, Icon, AreaChart, DonutChart, BarChart],
  host: { class: 'block space-y-6' },
  template: `
    <header>
      <h2 class="text-2xl font-bold text-text-primary">Statistiques & Prévisions</h2>
      <p class="mt-1 text-sm text-text-muted">Analyse de votre budget et projections futures</p>
    </header>

    <!-- KPI row -->
    <section class="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Indicateurs clés">
      @for (kpi of kpis(); track kpi.label) {
        <div class="rounded-xl border border-border bg-surface p-4">
          <div class="flex items-center gap-2 mb-2">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg" [class]="kpi.iconBg">
              <app-icon [name]="kpi.icon" size="16" [class]="kpi.iconColor" />
            </div>
            <span class="text-[11px] text-text-muted uppercase tracking-wider">{{ kpi.label }}</span>
          </div>
          <p class="text-xl font-mono font-bold" [class]="kpi.valueColor">
            {{ kpi.value | number:'1.0-0' }}<span class="text-sm ml-0.5">&euro;</span>
          </p>
          @if (kpi.sub) {
            <p class="text-[10px] text-text-muted mt-1">{{ kpi.sub }}</p>
          }
        </div>
      }
    </section>

    <!-- Charts row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

      <!-- Evolution budget 12 mois -->
      <section class="rounded-xl border border-border bg-surface overflow-hidden">
        <div class="flex items-center gap-2 px-5 py-3 bg-ib-green/5 border-b border-border/50">
          <app-icon name="trending-up" size="16" class="text-ib-green" />
          <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ib-green">Solde net — 12 mois</h3>
        </div>
        <div class="p-4 h-52">
          @if (balanceHistory().length > 1) {
            <app-area-chart [data]="balanceHistory()" color="var(--color-ib-green)" />
          } @else {
            <div class="flex items-center justify-center h-full text-sm text-text-muted">
              Pas assez de données (min. 2 archives)
            </div>
          }
        </div>
      </section>

      <!-- Répartition dépenses par catégorie -->
      <section class="rounded-xl border border-border bg-surface overflow-hidden">
        <div class="flex items-center gap-2 px-5 py-3 bg-ib-red/5 border-b border-border/50">
          <app-icon name="receipt" size="16" class="text-ib-red" />
          <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ib-red">Répartition dépenses</h3>
        </div>
        <div class="p-5">
          @if (expenseByCategory().length > 0) {
            <app-donut-chart [data]="expenseByCategory()"
                             [centerLabel]="totalExpensesLabel()"
                             centerSub="par mois" />
          } @else {
            <div class="flex items-center justify-center h-32 text-sm text-text-muted">
              Aucune dépense catégorisée
            </div>
          }
        </div>
      </section>

      <!-- Revenus vs Dépenses -->
      <section class="rounded-xl border border-border bg-surface overflow-hidden">
        <div class="flex items-center gap-2 px-5 py-3 bg-ib-blue/5 border-b border-border/50">
          <app-icon name="banknote" size="16" class="text-ib-blue" />
          <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ib-blue">Revenus vs Dépenses — 6 mois</h3>
        </div>
        <div class="p-4 h-52">
          @if (incomeVsExpenses().length > 0) {
            <app-bar-chart [data]="incomeVsExpenses()" />
          } @else {
            <div class="flex items-center justify-center h-full text-sm text-text-muted">
              Pas assez de données
            </div>
          }
        </div>
        <div class="flex items-center justify-center gap-6 pb-3 text-[10px] text-text-muted">
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-sm bg-ib-green"></span> Revenus
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-sm bg-ib-red"></span> Dépenses
          </span>
        </div>
      </section>

      <!-- Projection enveloppes -->
      <section class="rounded-xl border border-border bg-surface overflow-hidden">
        <div class="flex items-center gap-2 px-5 py-3 bg-ib-cyan/5 border-b border-border/50">
          <app-icon name="trending-up" size="16" class="text-ib-cyan" />
          <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ib-cyan">Projection enveloppes — 6 mois</h3>
        </div>
        <div class="p-4 h-52">
          @if (envelopeForecastChart().length > 1) {
            <app-area-chart [data]="envelopeForecastChart()" color="var(--color-ib-cyan)" />
          } @else {
            <div class="flex items-center justify-center h-full text-sm text-text-muted">
              Aucune enveloppe avec objectif
            </div>
          }
        </div>
      </section>
    </div>

    <!-- Forecasts section -->
    <section class="rounded-xl border border-border bg-surface overflow-hidden">
      <div class="flex items-center gap-2 px-5 py-3 bg-ib-purple/5 border-b border-border/50">
        <app-icon name="trending-up" size="16" class="text-ib-purple" />
        <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ib-purple">Prévisions</h3>
      </div>
      @if (forecasts().length > 0) {
        <div class="divide-y divide-border/30">
          @for (f of forecasts(); track f.label) {
            <div class="flex items-start gap-4 px-5 py-4 hover:bg-hover/30 transition-colors">
              <div class="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                   [style.background-color]="f.color + '15'">
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
          <p class="text-sm text-text-muted">Aucune prévision disponible</p>
          <p class="text-xs text-text-muted mt-1">Ajoutez des enveloppes avec objectif ou des prêts pour voir les projections</p>
        </div>
      }
    </section>
  `,
})
export class BudgetAnalytics {
  private readonly getArchives = inject(GetSalaryArchivesUseCase);
  private readonly getEntries = inject(GetRecurringEntriesUseCase);
  private readonly getEnvelopes = inject(GetEnvelopesUseCase);
  private readonly getLoans = inject(GetLoansUseCase);

  private readonly allData = toSignal(
    forkJoin({
      archives: this.getArchives.execute(),
      entries: this.getEntries.execute(),
      envelopes: this.getEnvelopes.execute(),
      loans: this.getLoans.execute(),
    }),
    { initialValue: { archives: [], entries: [], envelopes: [], loans: [] } },
  );

  private readonly archives = computed(() =>
    [...this.allData().archives].sort((a, b) => a.month.localeCompare(b.month)),
  );

  private readonly entries = computed(() => this.allData().entries);
  private readonly envelopes = computed(() => this.allData().envelopes);
  private readonly loans = computed(() => this.allData().loans);

  // ── KPIs ──

  private readonly monthlyIncome = computed(() =>
    this.entries().filter(e => e.type === 'income').reduce((s, e) => s + Number(e.amount), 0),
  );

  private readonly monthlyExpenses = computed(() =>
    this.entries().filter(e => e.type === 'expense').reduce((s, e) => s + Number(e.amount), 0),
  );

  private readonly monthlyAnnual = computed(() =>
    this.entries().filter(e => e.type === 'annual_expense').reduce((s, e) => s + Number(e.amount), 0) / 12,
  );

  private readonly monthlySpendings = computed(() =>
    this.entries().filter(e => e.type === 'spending').reduce((s, e) => s + Number(e.amount), 0),
  );

  private readonly monthlyEnvelopeCredits = computed(() =>
    this.entries()
      .filter(e => e.type === 'spending' && e.category === 'Enveloppe')
      .reduce((s, e) => s + Number(e.amount), 0),
  );

  private readonly monthlyLoanPayments = computed(() =>
    this.entries()
      .filter(e => e.type === 'spending' && e.category === 'Remboursement')
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
    if (annual > 0) chargeParts.push(`${annual.toFixed(0)}€ annualisé`);
    if (envCredits > 0) chargeParts.push(`${envCredits.toFixed(0)}€ enveloppes`);
    if (loanPay > 0) chargeParts.push(`${loanPay.toFixed(0)}€ prêts`);
    if (otherSpendings > 0) chargeParts.push(`${otherSpendings.toFixed(0)}€ autres`);

    return [
      {
        label: 'Revenu mensuel',
        icon: 'trending-up' as const,
        iconBg: 'bg-ib-green/10',
        iconColor: 'text-ib-green',
        value: income,
        valueColor: 'text-ib-green',
        sub: null,
      },
      {
        label: 'Charges totales',
        icon: 'receipt' as const,
        iconBg: 'bg-ib-red/10',
        iconColor: 'text-ib-red',
        value: totalCharges,
        valueColor: 'text-ib-red',
        sub: chargeParts.length > 0 ? `dont ${chargeParts.join(', ')}` : null,
      },
      {
        label: 'Reste à vivre',
        icon: 'wallet' as const,
        iconBg: net >= 0 ? 'bg-ib-green/10' : 'bg-ib-red/10',
        iconColor: net >= 0 ? 'text-ib-green' : 'text-ib-red',
        value: net,
        valueColor: net >= 0 ? 'text-ib-green' : 'text-ib-red',
        sub: net > 0 ? 'Capacité d\'épargne disponible' : 'Déficit mensuel',
      },
      {
        label: 'Épargne totale',
        icon: 'mail' as const,
        iconBg: 'bg-ib-cyan/10',
        iconColor: 'text-ib-cyan',
        value: this.totalEnvelopeBalance(),
        valueColor: 'text-ib-cyan',
        sub: `${this.envelopes().length} enveloppes`,
      },
    ];
  });

  // ── Balance history (area chart) ──

  protected readonly balanceHistory = computed<AreaChartPoint[]>(() => {
    const arch = this.archives().slice(-12);
    return arch.map(a => ({
      label: formatMonth(a.month),
      value: Number(a.salary) - Number(a.totalExpenses) - Number(a.totalSpendings),
    }));
  });

  // ── Expense by category (donut) ──

  protected readonly expenseByCategory = computed<DonutSlice[]>(() => {
    const expenses = this.entries().filter(e => e.type === 'expense' || e.type === 'annual_expense');
    const catMap = new Map<string, number>();

    for (const e of expenses) {
      const cat = e.category || 'Autre';
      const amount = e.type === 'annual_expense' ? Number(e.amount) / 12 : Number(e.amount);
      catMap.set(cat, (catMap.get(cat) ?? 0) + amount);
    }

    return [...catMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label, value, color: categoryColor(label) }));
  });

  protected readonly totalExpensesLabel = computed(() => {
    const total = this.expenseByCategory().reduce((s, d) => s + d.value, 0);
    return total >= 1000 ? `${(total / 1000).toFixed(1)}k€` : `${total.toFixed(0)}€`;
  });

  // ── Income vs Expenses (bar chart) ──

  protected readonly incomeVsExpenses = computed<BarGroup[]>(() => {
    const arch = this.archives().slice(-6);
    return arch.map(a => ({
      label: formatMonth(a.month),
      bars: [
        { value: Number(a.salary), color: 'var(--color-ib-green)' },
        { value: Number(a.totalExpenses) + Number(a.totalSpendings), color: 'var(--color-ib-red)' },
      ],
    }));
  });

  // ── Envelope forecast chart ──

  protected readonly envelopeForecastChart = computed<AreaChartPoint[]>(() => {
    const envs = this.envelopes().filter(e => e.target && Number(e.target) > 0);
    if (envs.length === 0) return [];

    const envCredits = this.monthlyEnvelopeCredits();
    const totalBalance = envs.reduce((s, e) => s + Number(e.balance), 0);
    const totalTarget = envs.reduce((s, e) => s + Number(e.target ?? 0), 0);
    const monthlyContrib = envCredits > 0 ? envCredits : (totalTarget - totalBalance) / 12;

    const now = new Date();
    const points: AreaChartPoint[] = [{ label: 'Auj.', value: totalBalance }];

    for (let i = 1; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const projected = Math.min(totalBalance + monthlyContrib * i, totalTarget);
      points.push({
        label: MONTH_LABELS[d.getMonth()],
        value: projected,
      });
    }

    return points;
  });

  // ── Forecasts ──

  protected readonly forecasts = computed<Forecast[]>(() => {
    const results: Forecast[] = [];
    const income = this.monthlyIncome();
    const totalCharges = this.monthlyExpenses() + this.monthlyAnnual() + this.monthlySpendings();
    const net = income - totalCharges;
    const envCredits = this.monthlyEnvelopeCredits();
    const loanPay = this.monthlyLoanPayments();

    if (net > 0) {
      results.push({
        label: 'Reste à vivre',
        icon: 'trending-up',
        color: 'var(--color-ib-green)',
        message: `Il vous reste ${net.toFixed(0)}€ après toutes charges, épargne et remboursements`,
        detail: `Sur 6 mois : +${(net * 6).toFixed(0)}€ | Sur 12 mois : +${(net * 12).toFixed(0)}€`,
        type: 'balance',
      });
    } else if (net < 0) {
      results.push({
        label: 'Déficit mensuel',
        icon: 'alert-triangle',
        color: 'var(--color-ib-red)',
        message: `Vos dépenses dépassent vos revenus de ${Math.abs(net).toFixed(0)}€ par mois`,
        detail: `Réduction nécessaire : ${Math.abs(net).toFixed(0)}€/mois pour équilibrer le budget`,
        type: 'balance',
      });
    }

    const envsWithTarget = this.envelopes().filter(e => Number(e.target ?? 0) > 0);
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
        const targetLabel = `${MONTH_LABELS[targetDate.getMonth()]} ${targetDate.getFullYear()}`;

        results.push({
          label: `Enveloppe « ${env.name} »`,
          icon: 'wallet',
          color: env.color || 'var(--color-ib-cyan)',
          message: months <= 1
            ? `Objectif atteint le mois prochain !`
            : `Objectif atteint dans ${months} mois (${targetLabel})`,
          detail: `${envBalance.toFixed(0)}€ / ${envTarget.toFixed(0)}€ — reste ${remaining.toFixed(0)}€ à ~${monthlyContrib.toFixed(0)}€/mois`,
          type: 'envelope',
        });
      } else {
        results.push({
          label: `Enveloppe « ${env.name} »`,
          icon: 'wallet',
          color: env.color || 'var(--color-ib-cyan)',
          message: `Reste ${remaining.toFixed(0)}€ pour atteindre l'objectif`,
          detail: `${envBalance.toFixed(0)}€ / ${envTarget.toFixed(0)}€ — aucun versement récurrent détecté`,
          type: 'envelope',
        });
      }
    }

    const activeLoans = this.loans().filter(l => Number(l.remaining) > 0);
    for (const loan of this.loans()) {
      const loanAmount = Number(loan.amount);
      const loanRemaining = Number(loan.remaining);
      if (loanRemaining <= 0) continue;

      const repaid = loanAmount - loanRemaining;
      const pct = loanAmount > 0 ? (repaid / loanAmount) * 100 : 0;

      const monthlyPayment = loanPay > 0
        ? loanPay / Math.max(activeLoans.length, 1)
        : 0;

      if (monthlyPayment > 0) {
        const months = Math.ceil(loanRemaining / monthlyPayment);
        const clearDate = new Date();
        clearDate.setMonth(clearDate.getMonth() + months);
        const clearLabel = `${MONTH_LABELS[clearDate.getMonth()]} ${clearDate.getFullYear()}`;
        const direction = loan.direction === 'lent' ? 'Prêt' : 'Dette';

        results.push({
          label: `${direction} — ${loan.person}`,
          icon: loan.direction === 'lent' ? 'arrow-up-right' : 'arrow-down-left',
          color: loan.direction === 'lent' ? 'var(--color-ib-blue)' : 'var(--color-ib-orange)',
          message: months <= 1
            ? `Remboursé le mois prochain !`
            : `Remboursé dans ${months} mois (${clearLabel})`,
          detail: `${pct.toFixed(0)}% remboursé — reste ${loanRemaining.toFixed(0)}€ à ~${monthlyPayment.toFixed(0)}€/mois`,
          type: 'loan',
        });
      } else {
        const direction = loan.direction === 'lent' ? 'Prêt' : 'Dette';
        results.push({
          label: `${direction} — ${loan.person}`,
          icon: loan.direction === 'lent' ? 'arrow-up-right' : 'arrow-down-left',
          color: loan.direction === 'lent' ? 'var(--color-ib-blue)' : 'var(--color-ib-orange)',
          message: `Reste ${loanRemaining.toFixed(0)}€ à rembourser`,
          detail: `${pct.toFixed(0)}% remboursé — aucun versement récurrent détecté`,
          type: 'loan',
        });
      }
    }

    return results;
  });
}
