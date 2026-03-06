import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { GetInvoicesUseCase } from '../../domain/use-cases/get-invoices.use-case';
import { GetFiscalPeriodsUseCase } from '../../domain/use-cases/get-fiscal-periods.use-case';

const STATUS_CLASSES: Record<string, string> = {
  draft: 'bg-ib-purple/15 text-ib-purple',
  sent: 'bg-ib-blue/15 text-ib-blue',
  paid: 'bg-ib-green/15 text-ib-green',
  overdue: 'bg-ib-red/15 text-ib-red',
  pending: 'bg-ib-orange/15 text-ib-orange',
};

@Component({
  selector: 'app-freelance-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  host: { class: 'block space-y-6' },
  template: `
    <header>
      <h2 class="text-2xl font-bold text-text-primary">Tableau de bord</h2>
      <p class="mt-1 text-sm text-text-muted">Vue d'ensemble de votre activite freelance</p>
    </header>

    <section aria-labelledby="kpi-heading" class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <h3 id="kpi-heading" class="sr-only">Indicateurs cles</h3>
      <article class="rounded-xl border border-border bg-surface p-4">
        <p class="text-sm text-text-muted">CA total</p>
        <p class="mt-1 text-2xl font-mono text-ib-cyan">{{ totalRevenue() | number:'1.2-2' }} &euro;</p>
      </article>
      <article class="rounded-xl border border-border bg-surface p-4">
        <p class="text-sm text-text-muted">Factures en attente</p>
        <p class="mt-1 text-2xl font-mono text-ib-orange">{{ pendingAmount() | number:'1.2-2' }} &euro;</p>
        <p class="text-xs text-text-muted mt-1">{{ pendingCount() }} facture(s)</p>
      </article>
      <article class="rounded-xl border border-border bg-surface p-4">
        <p class="text-sm text-text-muted">Provision fiscale</p>
        <p class="mt-1 text-2xl font-mono text-ib-yellow">{{ totalProvisioned() | number:'1.2-2' }} &euro;</p>
      </article>
    </section>

    <section aria-labelledby="recent-invoices-heading">
      <h3 id="recent-invoices-heading" class="text-lg font-semibold text-text-primary mb-3">Dernieres factures</h3>
      <div class="space-y-2">
        @for (invoice of invoices(); track invoice.id) {
          <article class="rounded-xl border border-border bg-surface p-4 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="rounded-full px-2 py-0.5 text-xs font-medium" [class]="statusClass(invoice.status)">
                {{ invoice.status }}
              </span>
              <div>
                <p class="font-medium text-text-primary">{{ invoice.reference }}</p>
                <p class="text-sm text-text-muted">{{ invoice.clientName }}</p>
              </div>
            </div>
            <p class="text-lg font-mono text-ib-cyan">{{ invoice.totalHt | number:'1.2-2' }} &euro;</p>
          </article>
        } @empty {
          <p class="text-text-muted">Aucune facture</p>
        }
      </div>
    </section>
  `,
})
export class FreelanceDashboard {
  private readonly getInvoices = inject(GetInvoicesUseCase);
  private readonly getFiscalPeriods = inject(GetFiscalPeriodsUseCase);

  protected readonly invoices = toSignal(this.getInvoices.execute(), { initialValue: [] });
  protected readonly fiscalPeriods = toSignal(this.getFiscalPeriods.execute(), { initialValue: [] });

  protected readonly totalRevenue = computed(() =>
    this.invoices().filter(i => i.status === 'paid').reduce((s, i) => s + i.totalHt, 0)
  );

  protected readonly pendingCount = computed(() =>
    this.invoices().filter(i => i.status === 'sent' || i.status === 'overdue').length
  );

  protected readonly pendingAmount = computed(() =>
    this.invoices().filter(i => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.totalHt, 0)
  );

  protected readonly totalProvisioned = computed(() =>
    this.fiscalPeriods().reduce((s, p) => s + p.provisioned, 0)
  );

  protected statusClass(status: string): string {
    return STATUS_CLASSES[status] ?? '';
  }
}
