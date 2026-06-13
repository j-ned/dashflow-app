import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { BillingGateway } from '@core/billing/billing.gateway';
import { EntitlementStore } from '@core/entitlements/entitlement.store';

@Component({
  selector: 'app-billing-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe],
  // display:block (pas 'contents') : section en flux vertical de page — 'contents' annulerait les marges du host et casserait l'espacement du parent
  host: { class: 'block' },
  template: `
    <section
      aria-labelledby="billing-heading"
      class="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden mb-8"
    >
      <div class="px-6 py-5 border-b border-border bg-surface/50">
        <h3 id="billing-heading" class="text-base font-semibold text-text-primary">
          {{ 'billing.sectionTitle' | transloco }}
        </h3>
      </div>
      <div class="p-6">
        @if (isPaid()) {
          <button
            type="button"
            data-testid="billing-manage"
            (click)="openPortal()"
            class="inline-flex items-center justify-center rounded-lg bg-ib-blue px-4 py-2.5 text-sm font-medium text-canvas transition-colors hover:bg-ib-blue/90"
          >
            {{ 'billing.managePlan' | transloco }}
          </button>
        } @else {
          <a
            routerLink="/upgrade"
            data-testid="billing-choose"
            class="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-hover"
          >
            {{ 'billing.choosePlan' | transloco }}
          </a>
        }
      </div>
    </section>
  `,
})
export class BillingSection {
  private readonly billing = inject(BillingGateway);
  private readonly entitlement = inject(EntitlementStore);

  protected readonly isPaid = computed(() => {
    const plan = this.entitlement.planKey();
    return plan !== null && plan !== 'solo';
  });

  protected openPortal(): void {
    void this.billing.openPortal();
  }
}
