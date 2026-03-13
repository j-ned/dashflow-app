import { afterNextRender, ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Icon } from '@shared/components/icon/icon';
import { toSignal } from '@angular/core/rxjs-interop';
import { Envelope } from '../../domain/models/envelope.model';
import { Loan } from '../../domain/models/loan.model';
import { RecurringEntry } from '../../domain/models/recurring-entry.model';
import { GetEnvelopesUseCase } from '../../domain/use-cases/get-envelopes.use-case';
import { GetLoansUseCase } from '../../domain/use-cases/get-loans.use-case';
import { GetMembersUseCase } from '../../domain/use-cases/get-members.use-case';
import { GetRecurringEntriesUseCase } from '../../domain/use-cases/get-recurring-entries.use-case';

type MemberSummary = {
  id: string | null;
  label: string;
  initials: string;
  envelopes: Envelope[];
  totalEnvelopes: number;
  lentLoans: Loan[];
  totalLent: number;
  borrowedLoans: Loan[];
  totalBorrowed: number;
  incomes: RecurringEntry[];
  totalIncome: number;
  monthlyExpenses: RecurringEntry[];
  totalMonthlyExpenses: number;
  annualExpenses: RecurringEntry[];
  totalAnnualExpenses: number;
  monthlyAnnualExpenses: number;
  spendings: RecurringEntry[];
  totalSpendings: number;
  remaining: number;
};

@Component({
  selector: 'app-budget-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, RouterLink, Icon],
  host: { class: 'block space-y-6' },
  template: `
    <header>
      <h2 class="text-2xl font-bold text-text-primary">Vue globale</h2>
      <p class="mt-1 text-sm text-text-muted">Soldes et alertes de votre budget</p>
    </header>

    <!-- Section par membre -->
    @for (ms of memberSummaries(); track ms.id) {
      <section class="rounded-xl border border-border bg-surface overflow-hidden">
        <!-- Member header -->
        <div class="flex items-center gap-3 px-5 py-4 border-b border-border/50 bg-raised/30">
          <div class="flex h-11 w-11 items-center justify-center rounded-full bg-ib-green/10 text-ib-green text-sm font-bold shrink-0 ring-2 ring-ib-green/20">
            {{ ms.initials }}
          </div>
          <div>
            <h3 class="text-lg font-semibold text-text-primary">{{ ms.label }}</h3>
            <p class="text-[11px] text-text-muted">
              {{ ms.envelopes.length }} enveloppe{{ ms.envelopes.length > 1 ? 's' : '' }}
              · {{ ms.lentLoans.length + ms.borrowedLoans.length }} prêt{{ (ms.lentLoans.length + ms.borrowedLoans.length) > 1 ? 's' : '' }}
              @if (ms.incomes.length > 0) {
                · {{ ms.incomes.length }} revenu{{ ms.incomes.length > 1 ? 's' : '' }}
              }
            </p>
          </div>
        </div>

        <div class="p-5 space-y-5">
          <!-- Mini KPIs du membre -->
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            @if (ms.envelopes.length > 0) {
              <div class="group relative overflow-hidden rounded-xl border border-border bg-surface p-4 transition-all hover:border-ib-cyan/30 hover:shadow-lg hover:shadow-ib-cyan/5">
                <div class="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-ib-cyan"></div>
                <div class="flex items-center gap-1.5 mb-2">
                  <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-cyan/10">
                    <app-icon name="wallet" size="12" class="text-ib-cyan" />
                  </div>
                  <p class="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Enveloppes</p>
                </div>
                <p class="text-lg font-mono font-bold text-ib-cyan tracking-tight">{{ ms.totalEnvelopes | number:'1.2-2' }}<span class="text-xs ml-0.5">&euro;</span></p>
              </div>
            }
            @if (ms.lentLoans.length > 0) {
              <div class="group relative overflow-hidden rounded-xl border border-border bg-surface p-4 transition-all hover:border-ib-blue/30 hover:shadow-lg hover:shadow-ib-blue/5">
                <div class="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-ib-blue"></div>
                <div class="flex items-center gap-1.5 mb-2">
                  <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-blue/10">
                    <app-icon name="arrow-up-right" size="12" class="text-ib-blue" />
                  </div>
                  <p class="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Prêté</p>
                </div>
                <p class="text-lg font-mono font-bold text-ib-blue tracking-tight">{{ ms.totalLent | number:'1.2-2' }}<span class="text-xs ml-0.5">&euro;</span></p>
              </div>
            }
            @if (ms.borrowedLoans.length > 0) {
              <div class="group relative overflow-hidden rounded-xl border border-border bg-surface p-4 transition-all hover:border-ib-red/30 hover:shadow-lg hover:shadow-ib-red/5">
                <div class="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-ib-red"></div>
                <div class="flex items-center gap-1.5 mb-2">
                  <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-red/10">
                    <app-icon name="arrow-down-left" size="12" class="text-ib-red" />
                  </div>
                  <p class="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Emprunté</p>
                </div>
                <p class="text-lg font-mono font-bold text-ib-red tracking-tight">{{ ms.totalBorrowed | number:'1.2-2' }}<span class="text-xs ml-0.5">&euro;</span></p>
              </div>
            }
            @if (ms.incomes.length > 0) {
              <div class="group relative overflow-hidden rounded-xl border border-border bg-surface p-4 transition-all hover:border-ib-green/30 hover:shadow-lg hover:shadow-ib-green/5">
                <div class="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-ib-green"></div>
                <div class="flex items-center gap-1.5 mb-2">
                  <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-green/10">
                    <app-icon name="trending-up" size="12" class="text-ib-green" />
                  </div>
                  <p class="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Revenus</p>
                </div>
                <p class="text-lg font-mono font-bold text-ib-green tracking-tight">{{ ms.totalIncome | number:'1.2-2' }}<span class="text-xs ml-0.5">&euro;</span></p>
              </div>
            }
            @if (ms.totalMonthlyExpenses + ms.monthlyAnnualExpenses + ms.totalSpendings > 0) {
              <div class="group relative overflow-hidden rounded-xl border border-border bg-surface p-4 transition-all hover:border-ib-orange/30 hover:shadow-lg hover:shadow-ib-orange/5">
                <div class="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-ib-orange"></div>
                <div class="flex items-center gap-1.5 mb-2">
                  <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-orange/10">
                    <app-icon name="receipt" size="12" class="text-ib-orange" />
                  </div>
                  <p class="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Charges / mois</p>
                </div>
                <p class="text-lg font-mono font-bold text-ib-orange tracking-tight">{{ ms.totalMonthlyExpenses + ms.monthlyAnnualExpenses + ms.totalSpendings | number:'1.2-2' }}<span class="text-xs ml-0.5">&euro;</span></p>
              </div>
            }
            @if (ms.incomes.length > 0) {
              <div class="group relative overflow-hidden rounded-xl border bg-surface p-4 transition-all"
                   [class.border-ib-green-40]="ms.remaining >= 0"
                   [class.border-ib-red-40]="ms.remaining < 0"
                   [class.hover:shadow-lg]="true"
                   [class.hover:shadow-ib-green-5]="ms.remaining >= 0"
                   [class.hover:shadow-ib-red-5]="ms.remaining < 0">
                <div class="absolute inset-y-0 left-0 w-1 rounded-l-xl"
                     [class.bg-ib-green]="ms.remaining >= 0"
                     [class.bg-ib-red]="ms.remaining < 0"></div>
                <div class="flex items-center gap-1.5 mb-2">
                  <div class="flex h-6 w-6 items-center justify-center rounded-lg"
                       [class.bg-ib-green-10]="ms.remaining >= 0"
                       [class.bg-ib-red-10]="ms.remaining < 0">
                    <app-icon name="wallet" size="12"
                              [class.text-ib-green]="ms.remaining >= 0"
                              [class.text-ib-red]="ms.remaining < 0" />
                  </div>
                  <p class="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Reste</p>
                </div>
                <p class="text-lg font-mono font-bold tracking-tight"
                   [class.text-ib-green]="ms.remaining >= 0"
                   [class.text-ib-red]="ms.remaining < 0">
                  {{ ms.remaining | number:'1.2-2' }}<span class="text-xs ml-0.5">&euro;</span>
                </p>
              </div>
            }
          </div>

          <!-- Barre utilisation budget du membre -->
          @if (ms.totalIncome > 0 && (ms.totalMonthlyExpenses + ms.monthlyAnnualExpenses + ms.totalSpendings) > 0) {
            @let allCharges = ms.totalMonthlyExpenses + ms.monthlyAnnualExpenses + ms.totalSpendings;
            @let pctBudget = (allCharges / ms.totalIncome) * 100;
            <div class="rounded-xl border border-border bg-surface p-3">
              <div class="flex items-center justify-between mb-2">
                <span class="text-[11px] font-medium text-text-muted">Budget utilisé</span>
                <span class="text-sm font-mono font-bold"
                      [class.text-ib-green]="pctBudget <= 80"
                      [class.text-ib-orange]="pctBudget > 80 && pctBudget <= 100"
                      [class.text-ib-red]="pctBudget > 100">
                  {{ pctBudget | number:'1.0-0' }}%
                </span>
              </div>
              <div class="h-2.5 rounded-full bg-hover overflow-hidden">
                <div class="h-full rounded-full transition-all duration-500 ease-out"
                     [style.width.%]="pctBudget > 100 ? 100 : pctBudget"
                     [class.bg-gradient-to-r]="true"
                     [class.from-ib-green]="pctBudget <= 80"
                     [class.to-ib-green-70]="pctBudget <= 80"
                     [class.from-ib-orange]="pctBudget > 80 && pctBudget <= 100"
                     [class.to-ib-orange-70]="pctBudget > 80 && pctBudget <= 100"
                     [class.from-ib-red]="pctBudget > 100"
                     [class.to-ib-red-70]="pctBudget > 100">
                </div>
              </div>
              <div class="flex items-center gap-4 mt-2 text-[10px] text-text-muted">
                <span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-ib-red"></span> Mensuels {{ ms.totalMonthlyExpenses | number:'1.0-0' }}&euro;</span>
                <span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-ib-orange"></span> Annuels ~{{ ms.monthlyAnnualExpenses | number:'1.0-0' }}&euro;/m</span>
                <span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-ib-yellow"></span> Dépenses {{ ms.totalSpendings | number:'1.0-0' }}&euro;</span>
              </div>
            </div>
          }

          <!-- Compte : prélèvements mensuels / annuels / dépenses -->
          @if (ms.monthlyExpenses.length > 0 || ms.annualExpenses.length > 0 || ms.spendings.length > 0) {
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">

              <!-- Prélèvements mensuels -->
              @if (ms.monthlyExpenses.length > 0) {
                <a data-dash-ref routerLink="/budget/account" class="rounded-xl border border-border bg-surface overflow-hidden hover:border-ib-red/30 transition-all hover:shadow-lg hover:shadow-ib-red/5">
                  <div class="flex items-center gap-2 px-4 py-2.5 bg-ib-red/5 border-b border-border/50">
                    <app-icon name="receipt" size="13" class="text-ib-red" />
                    <span class="text-[11px] font-semibold uppercase tracking-wider text-ib-red">Mensuels</span>
                    <span class="ml-auto text-sm font-mono font-bold text-ib-red">{{ ms.totalMonthlyExpenses | number:'1.2-2' }}&euro;</span>
                  </div>
                  <div class="divide-y divide-border/20 px-3 py-1">
                    @for (entry of ms.monthlyExpenses; track entry.id) {
                      <div class="flex items-center justify-between py-1.5">
                        <div class="flex items-center gap-2 min-w-0">
                          <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-red/10 text-ib-red text-[9px] font-bold shrink-0">
                            @if (entry.dayOfMonth) { {{ entry.dayOfMonth }} } @else { — }
                          </div>
                          <span class="text-[13px] text-text-primary truncate">{{ entry.label }}</span>
                        </div>
                        <span class="text-[13px] font-mono font-medium text-text-muted shrink-0 ml-2">{{ entry.amount | number:'1.2-2' }}&euro;</span>
                      </div>
                    }
                  </div>
                </a>
              }

              <!-- Prélèvements annuels -->
              @if (ms.annualExpenses.length > 0) {
                <a routerLink="/budget/account" class="flex flex-col rounded-xl border border-border bg-surface overflow-hidden hover:border-ib-orange/30 transition-all hover:shadow-lg hover:shadow-ib-orange/5" [style.max-height.px]="dashRefCardHeight()">
                  <div class="flex items-center gap-2 px-4 py-2.5 bg-ib-orange/5 border-b border-border/50 shrink-0">
                    <app-icon name="calendar" size="13" class="text-ib-orange" />
                    <span class="text-[11px] font-semibold uppercase tracking-wider text-ib-orange">Annuels</span>
                    <span class="ml-auto text-sm font-mono font-bold text-ib-orange">{{ ms.totalAnnualExpenses | number:'1.2-2' }}&euro;/an</span>
                  </div>
                  <div class="divide-y divide-border/20 px-3 py-1 overflow-y-auto flex-1">
                    @for (entry of ms.annualExpenses; track entry.id) {
                      <div class="flex items-center justify-between py-1.5">
                        <span class="text-[13px] text-text-primary truncate">{{ entry.label }}</span>
                        <div class="flex items-center gap-1 shrink-0 ml-2">
                          <span class="text-[13px] font-mono font-medium text-text-muted">{{ entry.amount | number:'1.2-2' }}&euro;</span>
                          <span class="text-[10px] text-text-muted">(~{{ entry.amount / 12 | number:'1.0-0' }}/m)</span>
                        </div>
                      </div>
                    }
                  </div>
                </a>
              }

              <!-- Dépenses -->
              @if (ms.spendings.length > 0) {
                <a routerLink="/budget/account" class="flex flex-col rounded-xl border border-border bg-surface overflow-hidden hover:border-ib-yellow/30 transition-all hover:shadow-lg hover:shadow-ib-yellow/5" [style.max-height.px]="dashRefCardHeight()">
                  <div class="flex items-center gap-2 px-4 py-2.5 bg-ib-yellow/5 border-b border-border/50 shrink-0">
                    <app-icon name="banknote" size="13" class="text-ib-yellow" />
                    <span class="text-[11px] font-semibold uppercase tracking-wider text-ib-yellow">Dépenses</span>
                    <span class="ml-auto text-sm font-mono font-bold text-ib-yellow">{{ ms.totalSpendings | number:'1.2-2' }}&euro;</span>
                  </div>
                  <div class="divide-y divide-border/20 px-3 py-1 overflow-y-auto flex-1">
                    @for (entry of ms.spendings; track entry.id) {
                      <div class="flex items-center justify-between py-1.5">
                        <div class="flex items-center gap-2 min-w-0">
                          @if (entry.category) {
                            <span class="text-[10px] text-text-muted">{{ entry.category }}</span>
                          }
                          <span class="text-[13px] text-text-primary truncate">{{ entry.label }}</span>
                        </div>
                        <span class="text-[13px] font-mono font-medium text-text-muted shrink-0 ml-2">{{ entry.amount | number:'1.2-2' }}&euro;</span>
                      </div>
                    }
                  </div>
                </a>
              }

            </div>
          }

          <!-- Enveloppes du membre -->
          @if (ms.envelopes.length > 0) {
            <div class="rounded-xl border border-border bg-surface overflow-hidden">
              <div class="flex items-center gap-2 px-4 py-2.5 bg-ib-cyan/5 border-b border-border/50">
                <app-icon name="wallet" size="14" class="text-ib-cyan" />
                <h4 class="text-[11px] font-semibold uppercase tracking-wider text-ib-cyan">Enveloppes</h4>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 divide-border/20">
                @for (env of ms.envelopes; track env.id) {
                  <a routerLink="/budget/envelopes" class="p-4 hover:bg-ib-cyan/3 transition-colors">
                    <div class="flex items-center justify-between mb-1">
                      <p class="text-sm font-medium text-text-primary truncate">{{ env.name }}</p>
                      <span class="rounded-full px-1.5 py-0.5 text-[9px] font-medium shrink-0"
                            [style.background-color]="env.color + '20'"
                            [style.color]="env.color">
                        {{ env.type }}
                      </span>
                    </div>
                    <p class="text-lg font-mono font-bold text-ib-cyan">{{ env.balance | number:'1.2-2' }}<span class="text-sm ml-0.5">&euro;</span></p>
                    @if (env.target) {
                      @let pct = (env.balance / env.target) * 100;
                      <div class="mt-2">
                        <div class="flex justify-between text-[10px] text-text-muted mb-0.5">
                          <span>{{ env.target | number:'1.0-0' }}&euro;</span>
                          <span class="font-mono">{{ pct | number:'1.0-0' }}%</span>
                        </div>
                        <div class="h-1.5 rounded-full bg-hover overflow-hidden">
                          <div class="h-full rounded-full transition-all"
                               [style.width.%]="pct > 100 ? 100 : pct"
                               [style.background-color]="env.color"></div>
                        </div>
                      </div>
                    }
                  </a>
                }
              </div>
            </div>
          }

          <!-- Prêts du membre -->
          @if (ms.lentLoans.length > 0) {
            <div class="rounded-xl border border-border bg-surface overflow-hidden">
              <div class="flex items-center gap-2 px-4 py-2.5 bg-ib-blue/5 border-b border-border/50">
                <app-icon name="arrow-up-right" size="14" class="text-ib-blue" />
                <h4 class="text-[11px] font-semibold uppercase tracking-wider text-ib-blue">Prêts</h4>
              </div>
              <div class="divide-y divide-border/20">
                @for (loan of ms.lentLoans; track loan.id) {
                  @let pct = loan.amount > 0 ? ((loan.amount - loan.remaining) / loan.amount) * 100 : 0;
                  <a routerLink="/budget/loans" class="flex items-center justify-between px-4 py-3 hover:bg-ib-blue/3 transition-colors">
                    <div class="flex items-center gap-3 min-w-0">
                      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-ib-blue/10 text-ib-blue text-xs font-bold shrink-0">
                        {{ pct | number:'1.0-0' }}%
                      </div>
                      <div class="min-w-0">
                        <p class="text-sm font-medium text-text-primary truncate">{{ loan.person }}</p>
                        <div class="h-1 w-24 rounded-full bg-hover mt-1 overflow-hidden">
                          <div class="h-full rounded-full bg-ib-blue transition-all" [style.width.%]="pct > 100 ? 100 : pct"></div>
                        </div>
                      </div>
                    </div>
                    <span class="text-sm font-mono font-bold text-ib-blue shrink-0">{{ loan.remaining | number:'1.2-2' }}<span class="text-xs">&euro;</span></span>
                  </a>
                }
              </div>
            </div>
          }

          <!-- Dettes du membre -->
          @if (ms.borrowedLoans.length > 0) {
            <div class="rounded-xl border border-border bg-surface overflow-hidden">
              <div class="flex items-center gap-2 px-4 py-2.5 bg-ib-orange/5 border-b border-border/50">
                <app-icon name="arrow-down-left" size="14" class="text-ib-orange" />
                <h4 class="text-[11px] font-semibold uppercase tracking-wider text-ib-orange">Dettes</h4>
              </div>
              <div class="divide-y divide-border/20">
                @for (loan of ms.borrowedLoans; track loan.id) {
                  @let pct = loan.amount > 0 ? ((loan.amount - loan.remaining) / loan.amount) * 100 : 0;
                  <a routerLink="/budget/loans" class="flex items-center justify-between px-4 py-3 hover:bg-ib-orange/3 transition-colors">
                    <div class="flex items-center gap-3 min-w-0">
                      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-ib-orange/10 text-ib-orange text-xs font-bold shrink-0">
                        {{ pct | number:'1.0-0' }}%
                      </div>
                      <div class="min-w-0">
                        <p class="text-sm font-medium text-text-primary truncate">{{ loan.person }}</p>
                        <div class="h-1 w-24 rounded-full bg-hover mt-1 overflow-hidden">
                          <div class="h-full rounded-full bg-ib-orange transition-all" [style.width.%]="pct > 100 ? 100 : pct"></div>
                        </div>
                      </div>
                    </div>
                    <span class="text-sm font-mono font-bold text-ib-red shrink-0">{{ loan.remaining | number:'1.2-2' }}<span class="text-xs">&euro;</span></span>
                  </a>
                }
              </div>
            </div>
          }
        </div>
      </section>
    }
  `,
})
export class BudgetDashboard {
  private readonly _el = inject(ElementRef);
  private readonly getEnvelopes = inject(GetEnvelopesUseCase);
  private readonly getLoans = inject(GetLoansUseCase);
  private readonly getMembersUC = inject(GetMembersUseCase);
  private readonly getEntries = inject(GetRecurringEntriesUseCase);

  protected readonly dashRefCardHeight = signal<number | null>(null);

  constructor() {
    afterNextRender(() => {
      const host = this._el.nativeElement as HTMLElement;
      const tryObserve = () => {
        const el = host.querySelector('[data-dash-ref]');
        if (!el) return false;
        const ro = new ResizeObserver(([entry]) => this.dashRefCardHeight.set(entry.borderBoxSize[0].blockSize));
        ro.observe(el);
        return true;
      };
      if (!tryObserve()) {
        const mo = new MutationObserver(() => { if (tryObserve()) mo.disconnect(); });
        mo.observe(host, { childList: true, subtree: true });
      }
    });
  }

  protected readonly envelopes = toSignal(this.getEnvelopes.execute(), { initialValue: [] });
  protected readonly loans = toSignal(this.getLoans.execute(), { initialValue: [] });
  protected readonly members = toSignal(this.getMembersUC.execute(), { initialValue: [] });
  protected readonly entries = toSignal(this.getEntries.execute(), { initialValue: [] });

  protected readonly memberSummaries = computed<MemberSummary[]>(() => {
    const envs = this.envelopes();
    const allLoans = this.loans();
    const allEntries = this.entries();
    const mbrs = this.members();

    const buildSummary = (id: string | null, label: string, initials: string): MemberSummary => {
      const filter = (items: { memberId: string | null }[]) =>
        items.filter(i => (id ? i.memberId === id : !i.memberId));

      const mEnvs = filter(envs) as Envelope[];
      const mLoans = filter(allLoans) as Loan[];
      const mEntries = filter(allEntries) as RecurringEntry[];
      const lent = mLoans.filter(l => l.direction === 'lent');
      const borrowed = mLoans.filter(l => l.direction === 'borrowed');
      const incomes = mEntries.filter(e => e.type === 'income');
      const monthlyExp = mEntries.filter(e => e.type === 'expense').sort((a, b) => (a.dayOfMonth ?? 32) - (b.dayOfMonth ?? 32));
      const annualExp = mEntries.filter(e => e.type === 'annual_expense');
      const currentMonth = new Date().toISOString().slice(0, 7);
      const spendings = mEntries.filter(e => e.type === 'spending' && (!e.date || e.date.startsWith(currentMonth)));

      const totalIncome = incomes.reduce((s, e) => s + Number(e.amount), 0);
      const totalMonthlyExp = monthlyExp.reduce((s, e) => s + Number(e.amount), 0);
      const totalAnnualExp = annualExp.reduce((s, e) => s + Number(e.amount), 0);
      const monthlyAnnual = totalAnnualExp / 12;
      const totalSpend = spendings.reduce((s, e) => s + Number(e.amount), 0);

      return {
        id,
        label,
        initials,
        envelopes: mEnvs,
        totalEnvelopes: mEnvs.reduce((s, e) => s + e.balance, 0),
        lentLoans: lent,
        totalLent: lent.reduce((s, l) => s + l.remaining, 0),
        borrowedLoans: borrowed,
        totalBorrowed: borrowed.reduce((s, l) => s + l.remaining, 0),
        incomes,
        totalIncome,
        monthlyExpenses: monthlyExp,
        totalMonthlyExpenses: totalMonthlyExp,
        annualExpenses: annualExp,
        totalAnnualExpenses: totalAnnualExp,
        monthlyAnnualExpenses: monthlyAnnual,
        spendings,
        totalSpendings: totalSpend,
        remaining: totalIncome - totalMonthlyExp - monthlyAnnual - totalSpend,
      };
    };

    const summaries: MemberSummary[] = [];

    const global = buildSummary(null, 'Global (famille)', 'GL');
    if (global.envelopes.length > 0 || global.lentLoans.length > 0 || global.borrowedLoans.length > 0
        || global.incomes.length > 0 || global.monthlyExpenses.length > 0
        || global.annualExpenses.length > 0 || global.spendings.length > 0) {
      summaries.push(global);
    }

    for (const m of mbrs) {
      const ms = buildSummary(m.id, `${m.firstName} ${m.lastName}`, `${m.firstName[0]}${m.lastName[0]}`);
      if (ms.envelopes.length > 0 || ms.lentLoans.length > 0 || ms.borrowedLoans.length > 0
          || ms.incomes.length > 0 || ms.monthlyExpenses.length > 0
          || ms.annualExpenses.length > 0 || ms.spendings.length > 0) {
        summaries.push(ms);
      }
    }

    return summaries;
  });
}
