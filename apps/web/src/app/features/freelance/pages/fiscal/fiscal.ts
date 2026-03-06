import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { GetFiscalPeriodsUseCase } from '../../domain/use-cases/get-fiscal-periods.use-case';

@Component({
  selector: 'app-fiscal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  host: { class: 'block space-y-6' },
  template: `
    <header>
      <h2 class="text-2xl font-bold text-text-primary">Impots & URSSAF</h2>
      <p class="mt-1 text-sm text-text-muted">Suivi des provisions fiscales (micro-entreprise)</p>
    </header>

    <section aria-labelledby="fiscal-summary" class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <h3 id="fiscal-summary" class="sr-only">Resume fiscal</h3>
      <article class="rounded-xl border border-border bg-surface p-4">
        <p class="text-sm text-text-muted">Total impots dus</p>
        <p class="mt-1 text-2xl font-mono text-ib-yellow">{{ totalTaxDue() | number:'1.2-2' }} &euro;</p>
      </article>
      <article class="rounded-xl border border-border bg-surface p-4">
        <p class="text-sm text-text-muted">Total charges sociales</p>
        <p class="mt-1 text-2xl font-mono text-ib-orange">{{ totalSocialCharges() | number:'1.2-2' }} &euro;</p>
      </article>
      <article class="rounded-xl border border-border bg-surface p-4">
        <p class="text-sm text-text-muted">Total provisionne</p>
        <p class="mt-1 text-2xl font-mono text-ib-green">{{ totalProvisioned() | number:'1.2-2' }} &euro;</p>
      </article>
    </section>

    <section aria-labelledby="periods-heading">
      <h3 id="periods-heading" class="text-lg font-semibold text-text-primary mb-3">Periodes fiscales</h3>
      <table class="w-full text-left">
        <thead>
          <tr class="border-b border-border text-sm text-text-muted">
            <th class="pb-3 font-medium">Periode</th>
            <th class="pb-3 font-medium text-right">CA</th>
            <th class="pb-3 font-medium text-right">Impots</th>
            <th class="pb-3 font-medium text-right">Charges</th>
            <th class="pb-3 font-medium text-right">Provisionne</th>
            <th class="pb-3 font-medium text-right">Statut</th>
          </tr>
        </thead>
        <tbody>
          @for (period of periods(); track period.id) {
            <tr class="border-b border-border/50 hover:bg-hover/50 transition-colors">
              <td class="py-3 font-medium text-text-primary">{{ period.quarter }} {{ period.year }}</td>
              <td class="py-3 text-right font-mono text-ib-cyan">{{ period.revenue | number:'1.2-2' }} &euro;</td>
              <td class="py-3 text-right font-mono text-ib-yellow">{{ period.taxDue | number:'1.2-2' }} &euro;</td>
              <td class="py-3 text-right font-mono text-ib-orange">{{ period.socialCharges | number:'1.2-2' }} &euro;</td>
              <td class="py-3 text-right font-mono"
                  [class.text-ib-green]="period.provisioned >= (period.taxDue + period.socialCharges)"
                  [class.text-ib-red]="period.provisioned < (period.taxDue + period.socialCharges)">
                {{ period.provisioned | number:'1.2-2' }} &euro;
              </td>
              <td class="py-3 text-right">
                @if (period.declaredAt) {
                  <span class="rounded-full px-2 py-0.5 text-xs font-medium bg-ib-green/15 text-ib-green">Declare</span>
                } @else {
                  <span class="rounded-full px-2 py-0.5 text-xs font-medium bg-ib-orange/15 text-ib-orange">En attente</span>
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="6" class="py-12 text-center text-text-muted">Aucune periode fiscale</td>
            </tr>
          }
        </tbody>
      </table>
    </section>
  `,
})
export class Fiscal {
  private readonly getFiscalPeriods = inject(GetFiscalPeriodsUseCase);

  protected readonly periods = toSignal(this.getFiscalPeriods.execute(), { initialValue: [] });

  protected readonly totalTaxDue = computed(() =>
    this.periods().reduce((s, p) => s + p.taxDue, 0)
  );

  protected readonly totalSocialCharges = computed(() =>
    this.periods().reduce((s, p) => s + p.socialCharges, 0)
  );

  protected readonly totalProvisioned = computed(() =>
    this.periods().reduce((s, p) => s + p.provisioned, 0)
  );
}
