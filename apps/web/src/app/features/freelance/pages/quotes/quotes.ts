import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { GetQuotesUseCase } from '../../domain/use-cases/get-quotes.use-case';

const STATUS_CLASSES: Record<string, string> = {
  draft: 'bg-ib-purple/15 text-ib-purple',
  sent: 'bg-ib-blue/15 text-ib-blue',
  accepted: 'bg-ib-green/15 text-ib-green',
  rejected: 'bg-ib-red/15 text-ib-red',
  expired: 'bg-hover text-text-muted',
};

@Component({
  selector: 'app-quotes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  host: { class: 'block space-y-6' },
  template: `
    <header class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">Devis</h2>
        <p class="mt-1 text-sm text-text-muted">Gerez vos propositions commerciales</p>
      </div>
      <button type="button"
              class="rounded-lg bg-ib-blue px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-blue/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue">
        + Nouveau devis
      </button>
    </header>

    <section aria-label="Liste des devis">
      <table class="w-full text-left">
        <thead>
          <tr class="border-b border-border text-sm text-text-muted">
            <th class="pb-3 font-medium">Reference</th>
            <th class="pb-3 font-medium">Client</th>
            <th class="pb-3 font-medium">Statut</th>
            <th class="pb-3 font-medium text-right">Montant HT</th>
            <th class="pb-3 font-medium text-right">Valide jusqu'au</th>
          </tr>
        </thead>
        <tbody>
          @for (quote of quotes(); track quote.id) {
            <tr class="border-b border-border/50 hover:bg-hover/50 transition-colors">
              <td class="py-3 font-mono text-sm text-text-primary">{{ quote.reference }}</td>
              <td class="py-3 text-text-primary">{{ quote.clientName }}</td>
              <td class="py-3">
                <span class="rounded-full px-2 py-0.5 text-xs font-medium" [class]="statusClass(quote.status)">
                  {{ quote.status }}
                </span>
              </td>
              <td class="py-3 text-right font-mono text-ib-cyan">{{ quote.totalHt | number:'1.2-2' }} &euro;</td>
              <td class="py-3 text-right text-sm text-text-muted">{{ quote.validUntil }}</td>
            </tr>
          } @empty {
            <tr>
              <td colspan="5" class="py-12 text-center text-text-muted">Aucun devis. Creez votre premier devis.</td>
            </tr>
          }
        </tbody>
      </table>
    </section>
  `,
})
export class Quotes {
  private readonly getQuotes = inject(GetQuotesUseCase);

  protected readonly quotes = toSignal(this.getQuotes.execute(), { initialValue: [] });

  protected statusClass(status: string): string {
    return STATUS_CLASSES[status] ?? '';
  }
}
