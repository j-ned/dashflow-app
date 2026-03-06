import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { GetClientsUseCase } from '../../domain/use-cases/get-clients.use-case';

@Component({
  selector: 'app-clients',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block space-y-6' },
  template: `
    <header class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">Clients</h2>
        <p class="mt-1 text-sm text-text-muted">Gerez votre portefeuille clients</p>
      </div>
      <button type="button"
              class="rounded-lg bg-ib-blue px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-blue/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue">
        + Nouveau client
      </button>
    </header>

    <section aria-label="Liste des clients" class="space-y-3">
      @for (client of clients(); track client.id) {
        <article class="rounded-xl border border-border bg-surface p-4 hover:border-ib-blue/30 transition-colors">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-semibold text-text-primary">{{ client.name }}</h3>
              @if (client.company) {
                <p class="text-sm text-text-muted">{{ client.company }}</p>
              }
            </div>
            <div class="text-right text-sm text-text-muted">
              <p>{{ client.email }}</p>
              <p>{{ client.phone }}</p>
            </div>
          </div>
          @if (client.notes) {
            <p class="mt-2 text-xs text-text-muted border-t border-border/50 pt-2">{{ client.notes }}</p>
          }
        </article>
      } @empty {
        <p class="text-center text-text-muted py-12">Aucun client. Ajoutez votre premier client.</p>
      }
    </section>
  `,
})
export class Clients {
  private readonly getClients = inject(GetClientsUseCase);

  protected readonly clients = toSignal(this.getClients.execute(), { initialValue: [] });
}
