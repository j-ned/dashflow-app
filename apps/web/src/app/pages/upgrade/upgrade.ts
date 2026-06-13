import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';
import { PricingCards } from '@shared/components/pricing-cards/pricing-cards';
import { BillingGateway } from '@core/billing/billing.gateway';
import { Toaster } from '@shared/components/toast/toast';
import { FEATURE_PLAN } from '@core/entitlements/feature-plan';
import type { Feature, PlanKey } from '@core/entitlements/entitlement.types';

const DEFAULT_RETURN_URL = '/budget';

function safeInternalUrl(url: string | undefined): string {
  if (!url || !url.startsWith('/') || url.startsWith('//')) {
    return DEFAULT_RETURN_URL;
  }
  return url;
}

@Component({
  selector: 'app-upgrade',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full h-full overflow-y-auto' },
  imports: [RouterLink, TranslocoPipe, Icon, PricingCards],
  template: `
    <section aria-labelledby="upgrade-title" class="mx-auto max-w-6xl px-6 py-12">
      <header class="mx-auto max-w-2xl text-center">
        <div
          class="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-ib-yellow-10 text-ib-yellow"
        >
          <app-icon name="lock" [size]="24" />
        </div>

        <h1 id="upgrade-title" class="text-2xl font-semibold tracking-tight text-text-primary">
          {{ 'entitlement.paywall.title' | transloco }}
        </h1>

        <p class="mt-3 text-base leading-relaxed text-text-muted">
          @if (reason() === 'limit') {
            {{ 'entitlement.paywall.limit' | transloco: { limit: limit() ?? '' } }}
          } @else {
            {{ 'entitlement.paywall.feature' | transloco: { feature: feature() ?? '' } }}
          }
        </p>
      </header>

      <div class="mt-12">
        <h2 class="sr-only">{{ 'pricing.choosePlan' | transloco }}</h2>
        <app-pricing-cards
          context="app"
          [highlightPlan]="requiredPlan()"
          (selectPlan)="startCheckout($event)"
        />
      </div>

      <div class="mt-10 text-center">
        <a
          [routerLink]="safeReturnUrl()"
          class="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text-primary"
        >
          <app-icon name="arrow-left" [size]="14" />
          {{ 'entitlement.paywall.back' | transloco }}
        </a>
      </div>
    </section>
  `,
})
export class Upgrade {
  readonly feature = input<string>();
  readonly reason = input<string>();
  readonly limit = input<string>();
  readonly returnUrl = input<string>();
  readonly checkout = input<string>();

  private readonly billing = inject(BillingGateway);
  private readonly toaster = inject(Toaster);

  constructor() {
    effect(() => {
      if (this.checkout() === 'cancel') {
        this.toaster.info('billing.canceled');
      }
    });
  }

  protected startCheckout(plan: PlanKey): void {
    if (plan === 'solo') return;
    void this.billing.checkout(plan);
  }

  protected readonly safeReturnUrl = computed(() => safeInternalUrl(this.returnUrl()));

  /** Plan minimal qui débloque la feature ciblée par le gate, mis en avant dans la grille. */
  protected readonly requiredPlan = computed<PlanKey | undefined>(() => {
    const feature = this.feature();
    return feature && feature in FEATURE_PLAN ? FEATURE_PLAN[feature as Feature] : undefined;
  });
}
