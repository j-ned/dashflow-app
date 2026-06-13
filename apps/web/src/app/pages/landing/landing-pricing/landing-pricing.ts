import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';
import { PricingCards } from '@shared/components/pricing-cards/pricing-cards';

@Component({
  selector: 'app-landing-pricing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PricingCards, Icon, TranslocoPipe],
  host: { class: 'contents' },
  template: `
    <section id="pricing" class="border-t border-border bg-surface" aria-labelledby="pricing-title">
      <div class="mx-auto max-w-6xl px-6 py-24 lg:py-32">
        <header class="max-w-3xl">
          <span
            class="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-ib-blue"
          >
            <span aria-hidden="true" class="h-1.5 w-1.5 rounded-full bg-ib-blue"></span>
            {{ 'landing.pricing.eyebrow' | transloco }}
          </span>
          <h2 id="pricing-title" class="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            {{ 'landing.pricing.title' | transloco }}
          </h2>
          <p class="mt-4 text-lg leading-relaxed text-text-muted">
            {{ 'landing.pricing.subtitle' | transloco }}
          </p>
        </header>

        <div class="mt-12">
          <app-pricing-cards />
        </div>

        <p class="mt-8 flex items-center justify-center gap-2 text-center text-sm text-text-muted">
          <app-icon name="lock" [size]="14" class="shrink-0 text-ib-green" />
          {{ 'pricing.encryptionNote' | transloco }}
        </p>
      </div>
    </section>
  `,
})
export class LandingPricing {}
