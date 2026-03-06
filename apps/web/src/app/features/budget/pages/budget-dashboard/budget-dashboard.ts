import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { GetEnvelopesUseCase } from '../../domain/use-cases/get-envelopes.use-case';
import { GetLoansUseCase } from '../../domain/use-cases/get-loans.use-case';
import { GetConsumablesUseCase } from '../../domain/use-cases/get-consumables.use-case';

@Component({
  selector: 'app-budget-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  host: { class: 'block space-y-6' },
  template: `
    <header>
      <h2 class="text-2xl font-bold text-text-primary">Vue globale</h2>
      <p class="mt-1 text-sm text-text-muted">Soldes et alertes de votre budget</p>
    </header>

    <!-- KPI cards -->
    <section aria-labelledby="kpi-heading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <h3 id="kpi-heading" class="sr-only">Indicateurs clés</h3>

      <article class="rounded-xl border border-border bg-surface p-4">
        <p class="text-xs font-medium uppercase tracking-wider text-text-muted">Total enveloppes</p>
        <p class="mt-2 text-2xl font-mono font-semibold text-ib-cyan">{{ totalEnvelopes() | number:'1.2-2' }} &euro;</p>
        <p class="mt-1 text-xs text-text-muted">{{ envelopes().length }} enveloppe{{ envelopes().length > 1 ? 's' : '' }}</p>
      </article>

      <article class="rounded-xl border border-border bg-surface p-4">
        <p class="text-xs font-medium uppercase tracking-wider text-text-muted">Total prêté</p>
        <p class="mt-2 text-2xl font-mono font-semibold text-ib-blue">{{ totalLent() | number:'1.2-2' }} &euro;</p>
        <p class="mt-1 text-xs text-text-muted">{{ lentLoans().length }} prêt{{ lentLoans().length > 1 ? 's' : '' }} en cours</p>
      </article>

      <article class="rounded-xl border border-border bg-surface p-4">
        <p class="text-xs font-medium uppercase tracking-wider text-text-muted">Total emprunté</p>
        <p class="mt-2 text-2xl font-mono font-semibold text-ib-red">{{ totalBorrowed() | number:'1.2-2' }} &euro;</p>
        <p class="mt-1 text-xs text-text-muted">{{ borrowedLoans().length }} emprunt{{ borrowedLoans().length > 1 ? 's' : '' }} en cours</p>
      </article>

      <article class="rounded-xl border border-border bg-surface p-4">
        <p class="text-xs font-medium uppercase tracking-wider text-text-muted">Consommables</p>
        <p class="mt-2 text-2xl font-mono font-semibold"
           [class.text-ib-green]="lowStockCount() === 0"
           [class.text-ib-orange]="lowStockCount() > 0">
          {{ consumables().length }} articles
        </p>
        @if (lowStockCount() > 0) {
          <p class="mt-1 text-xs text-ib-orange">{{ lowStockCount() }} en stock bas</p>
        } @else {
          <p class="mt-1 text-xs text-ib-green">Stock OK</p>
        }
      </article>
    </section>

    <!-- Enveloppes detail -->
    @if (envelopes().length > 0) {
      <section aria-labelledby="env-detail-heading">
        <h3 id="env-detail-heading" class="text-lg font-semibold text-text-primary mb-3">Enveloppes</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          @for (envelope of envelopes(); track envelope.id) {
            <article class="rounded-xl border border-border bg-surface p-4">
              <div class="flex items-center justify-between mb-2">
                <p class="text-sm font-medium text-text-primary">{{ envelope.name }}</p>
                <span class="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      [style.background-color]="envelope.color + '20'"
                      [style.color]="envelope.color">
                  {{ envelope.type }}
                </span>
              </div>
              <p class="text-xl font-mono text-ib-cyan">{{ envelope.balance | number:'1.2-2' }} &euro;</p>
              @if (envelope.target) {
                @let pct = (envelope.balance / envelope.target) * 100;
                <div class="mt-3">
                  <div class="flex justify-between text-xs text-text-muted mb-1">
                    <span>Objectif : {{ envelope.target | number:'1.0-0' }} &euro;</span>
                    <span class="font-mono">{{ pct | number:'1.0-0' }}%</span>
                  </div>
                  <div class="h-1.5 rounded-full bg-hover">
                    <div class="h-full rounded-full transition-all duration-300"
                         [style.width.%]="pct > 100 ? 100 : pct"
                         [style.background-color]="envelope.color"></div>
                  </div>
                </div>
              }
            </article>
          }
        </div>
      </section>
    }

    <!-- Prets detail -->
    @if (lentLoans().length > 0) {
      <section aria-labelledby="lent-detail-heading">
        <h3 id="lent-detail-heading" class="text-lg font-semibold text-text-primary mb-3">Argent prêté</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          @for (loan of lentLoans(); track loan.id) {
            @let repaid = loan.amount - loan.remaining;
            @let pct = loan.amount > 0 ? (repaid / loan.amount) * 100 : 0;
            <article class="rounded-xl border border-border bg-surface p-4">
              <div class="flex items-center justify-between mb-1">
                <p class="font-medium text-text-primary">{{ loan.person }}</p>
                <span class="text-xs font-mono text-ib-blue">{{ loan.remaining | number:'1.2-2' }} &euro;</span>
              </div>
              @if (loan.description) {
                <p class="text-xs text-text-muted mb-2">{{ loan.description }}</p>
              }
              <dl class="grid grid-cols-2 gap-x-4 text-xs text-text-muted mb-3">
                <div>
                  <dt class="text-text-muted/70">Montant prêté</dt>
                  <dd class="font-mono text-text-primary">{{ loan.amount | number:'1.2-2' }} &euro;</dd>
                </div>
                <div>
                  <dt class="text-text-muted/70">Remboursé</dt>
                  <dd class="font-mono text-ib-green">{{ repaid | number:'1.2-2' }} &euro;</dd>
                </div>
              </dl>
              <div class="flex justify-between text-xs text-text-muted mb-1">
                <span>Remboursement</span>
                <span class="font-mono">{{ pct | number:'1.0-0' }}%</span>
              </div>
              <div class="h-1.5 rounded-full bg-hover">
                <div class="h-full rounded-full bg-ib-blue transition-all duration-300"
                     [style.width.%]="pct > 100 ? 100 : pct"></div>
              </div>
            </article>
          }
        </div>
      </section>
    }

    <!-- Emprunts detail -->
    @if (borrowedLoans().length > 0) {
      <section aria-labelledby="borrowed-detail-heading">
        <h3 id="borrowed-detail-heading" class="text-lg font-semibold text-text-primary mb-3">Argent emprunté</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          @for (loan of borrowedLoans(); track loan.id) {
            @let repaid = loan.amount - loan.remaining;
            @let pct = loan.amount > 0 ? (repaid / loan.amount) * 100 : 0;
            <article class="rounded-xl border border-border bg-surface p-4">
              <div class="flex items-center justify-between mb-1">
                <p class="font-medium text-text-primary">{{ loan.person }}</p>
                <span class="text-xs font-mono text-ib-red">{{ loan.remaining | number:'1.2-2' }} &euro;</span>
              </div>
              @if (loan.description) {
                <p class="text-xs text-text-muted mb-2">{{ loan.description }}</p>
              }
              <dl class="grid grid-cols-2 gap-x-4 text-xs text-text-muted mb-3">
                <div>
                  <dt class="text-text-muted/70">Montant emprunté</dt>
                  <dd class="font-mono text-text-primary">{{ loan.amount | number:'1.2-2' }} &euro;</dd>
                </div>
                <div>
                  <dt class="text-text-muted/70">Remboursé</dt>
                  <dd class="font-mono text-ib-green">{{ repaid | number:'1.2-2' }} &euro;</dd>
                </div>
              </dl>
              <div class="flex justify-between text-xs text-text-muted mb-1">
                <span>Remboursément</span>
                <span class="font-mono">{{ pct | number:'1.0-0' }}%</span>
              </div>
              <div class="h-1.5 rounded-full bg-hover">
                <div class="h-full rounded-full bg-ib-orange transition-all duration-300"
                     [style.width.%]="pct > 100 ? 100 : pct"></div>
              </div>
            </article>
          }
        </div>
      </section>
    }
  `,
})
export class BudgetDashboard {
  private readonly getEnvelopes = inject(GetEnvelopesUseCase);
  private readonly getLoans = inject(GetLoansUseCase);
  private readonly getConsumables = inject(GetConsumablesUseCase);

  protected readonly envelopes = toSignal(this.getEnvelopes.execute(), { initialValue: [] });
  protected readonly loans = toSignal(this.getLoans.execute(), { initialValue: [] });
  protected readonly consumables = toSignal(this.getConsumables.execute(), { initialValue: [] });

  protected readonly totalEnvelopes = computed(() =>
    this.envelopes().reduce((s, e) => s + e.balance, 0)
  );

  protected readonly lentLoans = computed(() =>
    this.loans().filter(l => l.direction === 'lent')
  );

  protected readonly borrowedLoans = computed(() =>
    this.loans().filter(l => l.direction === 'borrowed')
  );

  protected readonly totalLent = computed(() =>
    this.lentLoans().reduce((s, l) => s + l.remaining, 0)
  );

  protected readonly totalBorrowed = computed(() =>
    this.borrowedLoans().reduce((s, l) => s + l.remaining, 0)
  );

  protected readonly lowStockCount = computed(() =>
    this.consumables().filter(c => c.quantity <= c.minThreshold).length
  );
}
