import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';

@Component({
  selector: 'app-landing-pricing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, TranslocoPipe],
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

        <div class="mt-12 grid gap-6 lg:grid-cols-2">
          <!-- Free -->
          <article class="flex flex-col rounded-lg border border-border bg-canvas p-8">
            <h3 class="font-mono text-xs uppercase tracking-[0.16em] text-text-muted">
              {{ 'landing.pricing.free.name' | transloco }}
            </h3>
            <p class="mt-4 flex items-baseline gap-1.5">
              <span class="text-4xl font-semibold tracking-tight">{{
                'landing.pricing.free.price' | transloco
              }}</span>
              <span class="text-sm text-text-muted">{{
                'landing.pricing.free.period' | transloco
              }}</span>
            </p>
            <p class="mt-3 text-base leading-relaxed text-text-muted">
              {{ 'landing.pricing.free.tagline' | transloco }}
            </p>
            <ul class="mt-6 space-y-3 border-t border-border pt-6 text-base text-text-primary">
              <li class="flex items-start gap-3">
                <app-icon name="check" [size]="16" class="mt-1 text-ib-green" />
                <span>{{ 'landing.pricing.free.feature1' | transloco }}</span>
              </li>
              <li class="flex items-start gap-3">
                <app-icon name="check" [size]="16" class="mt-1 text-ib-green" />
                <span>{{ 'landing.pricing.free.feature2' | transloco }}</span>
              </li>
              <li class="flex items-start gap-3">
                <app-icon name="check" [size]="16" class="mt-1 text-ib-green" />
                <span>{{ 'landing.pricing.free.feature3' | transloco }}</span>
              </li>
              <li class="flex items-start gap-3">
                <app-icon name="check" [size]="16" class="mt-1 text-ib-green" />
                <span>{{ 'landing.pricing.free.feature4' | transloco }}</span>
              </li>
            </ul>
            <a
              routerLink="/auth/register"
              class="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-border px-6 py-3 text-base font-medium text-text-primary transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >{{ 'landing.pricing.free.cta' | transloco }}</a
            >
          </article>

          <!-- Premium -->
          <article class="flex flex-col rounded-lg border border-ib-blue bg-canvas p-8">
            <div class="flex items-center justify-between gap-3">
              <h3 class="font-mono text-xs uppercase tracking-[0.16em] text-ib-blue">
                {{ 'landing.pricing.premium.name' | transloco }}
              </h3>
              <span
                class="rounded-md bg-ib-blue/10 px-2.5 py-1 font-mono text-xs uppercase tracking-[0.16em] text-ib-blue"
                >{{ 'landing.pricing.premium.badge' | transloco }}</span
              >
            </div>
            <p class="mt-4 flex items-baseline gap-1.5">
              <span class="text-4xl font-semibold tracking-tight text-ib-blue"
                >{{ premiumPrice() }}{{ 'landing.pricing.premium.currency' | transloco }}</span
              >
              <span class="text-sm text-text-muted">{{
                'landing.pricing.premium.period' | transloco
              }}</span>
            </p>
            <p class="mt-3 text-base leading-relaxed text-text-muted">
              {{ 'landing.pricing.premium.tagline' | transloco }}
            </p>
            <ul class="mt-6 space-y-3 border-t border-border pt-6 text-base text-text-primary">
              <li class="flex items-start gap-3">
                <app-icon name="check" [size]="16" class="mt-1 text-ib-blue" />
                <span>{{ 'landing.pricing.premium.feature1' | transloco }}</span>
              </li>
              <li class="flex items-start gap-3">
                <app-icon name="check" [size]="16" class="mt-1 text-ib-blue" />
                <span>{{ 'landing.pricing.premium.feature2' | transloco }}</span>
              </li>
              <li class="flex items-start gap-3">
                <app-icon name="check" [size]="16" class="mt-1 text-ib-blue" />
                <span>{{ 'landing.pricing.premium.feature3' | transloco }}</span>
              </li>
              <li class="flex items-start gap-3">
                <app-icon name="check" [size]="16" class="mt-1 text-ib-blue" />
                <span>{{ 'landing.pricing.premium.feature4' | transloco }}</span>
              </li>
              <li class="flex items-start gap-3">
                <app-icon name="check" [size]="16" class="mt-1 text-ib-blue" />
                <span>{{ 'landing.pricing.premium.feature5' | transloco }}</span>
              </li>
            </ul>
            <a
              routerLink="/auth/register"
              class="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-ib-blue px-6 py-3 text-base font-semibold text-canvas transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >{{ 'landing.pricing.premium.cta' | transloco }}</a
            >
          </article>
        </div>
      </div>
    </section>
  `,
})
export class LandingPricing {
  readonly premiumPrice = input.required<number>();
}
