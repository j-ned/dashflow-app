import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { GetInvoicesUseCase } from '../../domain/use-cases/get-invoices.use-case';

const STATUS_CLASSES: Record<string, string> = {
  draft: 'bg-ib-purple/15 text-ib-purple',
  sent: 'bg-ib-blue/15 text-ib-blue',
  paid: 'bg-ib-green/15 text-ib-green',
  overdue: 'bg-ib-red/15 text-ib-red',
  pending: 'bg-ib-orange/15 text-ib-orange',
};

@Component({
  selector: 'app-invoices',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  host: { class: 'block space-y-6' },
  template: `
    <header class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">Factures</h2>
        <p class="mt-1 text-sm text-text-muted">Suivez vos factures et paiements</p>
      </div>
      <button type="button"
              class="rounded-lg bg-ib-blue px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-blue/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue">
        + Nouvelle facture
      </button>
    </header>

    <section aria-labelledby="invoice-summary" class="grid grid-cols-1 md:grid-cols-4 gap-3">
      <h3 id="invoice-summary" class="sr-only">Resume factures</h3>
      <div class="rounded-lg border border-border bg-surface p-3 text-center">
        <p class="text-xs text-text-muted">Total</p>
        <p class="font-mono text-ib-cyan">{{ totalAll() | number:'1.2-2' }} &euro;</p>
      </div>
      <div class="rounded-lg border border-border bg-surface p-3 text-center">
        <p class="text-xs text-text-muted">Payees</p>
        <p class="font-mono text-ib-green">{{ totalPaid() | number:'1.2-2' }} &euro;</p>
      </div>
      <div class="rounded-lg border border-border bg-surface p-3 text-center">
        <p class="text-xs text-text-muted">En attente</p>
        <p class="font-mono text-ib-orange">{{ totalPending() | number:'1.2-2' }} &euro;</p>
      </div>
      <div class="rounded-lg border border-border bg-surface p-3 text-center">
        <p class="text-xs text-text-muted">En retard</p>
        <p class="font-mono text-ib-red">{{ totalOverdue() | number:'1.2-2' }} &euro;</p>
      </div>
    </section>

    <section aria-label="Liste des factures">
      <table class="w-full text-left">
        <thead>
          <tr class="border-b border-border text-sm text-text-muted">
            <th class="pb-3 font-medium">Reference</th>
            <th class="pb-3 font-medium">Client</th>
            <th class="pb-3 font-medium">Statut</th>
            <th class="pb-3 font-medium text-right">Montant HT</th>
            <th class="pb-3 font-medium text-right">Echeance</th>
          </tr>
        </thead>
        <tbody>
          @for (invoice of invoices(); track invoice.id) {
            <tr class="border-b border-border/50 hover:bg-hover/50 transition-colors">
              <td class="py-3 font-mono text-sm text-text-primary">{{ invoice.reference }}</td>
              <td class="py-3 text-text-primary">{{ invoice.clientName }}</td>
              <td class="py-3">
                <span class="rounded-full px-2 py-0.5 text-xs font-medium" [class]="statusClass(invoice.status)">
                  {{ invoice.status }}
                </span>
              </td>
              <td class="py-3 text-right font-mono text-ib-cyan">{{ invoice.totalHt | number:'1.2-2' }} &euro;</td>
              <td class="py-3 text-right text-sm text-text-muted">{{ invoice.dueDate }}</td>
            </tr>
          } @empty {
            <tr>
              <td colspan="5" class="py-12 text-center text-text-muted">Aucune facture</td>
            </tr>
          }
        </tbody>
      </table>
    </section>
  `,
})
export class Invoices {
  private readonly getInvoices = inject(GetInvoicesUseCase);

  protected readonly invoices = toSignal(this.getInvoices.execute(), { initialValue: [] });

  protected readonly totalAll = computed(() =>
    this.invoices().reduce((s, i) => s + i.totalHt, 0)
  );

  protected readonly totalPaid = computed(() =>
    this.invoices().filter(i => i.status === 'paid').reduce((s, i) => s + i.totalHt, 0)
  );

  protected readonly totalPending = computed(() =>
    this.invoices().filter(i => i.status === 'sent' || i.status === 'pending').reduce((s, i) => s + i.totalHt, 0)
  );

  protected readonly totalOverdue = computed(() =>
    this.invoices().filter(i => i.status === 'overdue').reduce((s, i) => s + i.totalHt, 0)
  );

  protected statusClass(status: string): string {
    return STATUS_CLASSES[status] ?? '';
  }
}
