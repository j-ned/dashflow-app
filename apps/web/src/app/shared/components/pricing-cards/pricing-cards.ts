import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';
import type { PlanKey } from '@core/entitlements/entitlement.types';
import { PRICING_PLANS, type PricingPlanView } from '@core/entitlements/pricing-plans';

const CTA_BASE =
  'mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-6 py-3 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface ';
const CTA_PRIMARY = 'bg-ib-blue font-semibold text-canvas hover:bg-ib-blue/90';
const CTA_SECONDARY = 'border border-border font-medium text-text-primary hover:bg-hover';

type PlanCard = PricingPlanView & {
  readonly nameKey: string;
  readonly priceKey: string;
  readonly periodKey: string;
  readonly taglineKey: string;
  readonly ctaKey: string;
  readonly showCta: boolean;
  readonly articleClass: string;
  readonly nameClass: string;
  readonly priceClass: string;
  readonly ctaClass: string;
};

/** Grille présentational des 3 plans, partagée par la landing et la page `/upgrade`. */
@Component({
  selector: 'app-pricing-cards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  imports: [RouterLink, Icon, TranslocoPipe],
  template: `
    <div class="grid gap-6 lg:grid-cols-3">
      @for (card of cards(); track card.key) {
        <article [class]="card.articleClass" [attr.data-testid]="'pricing-card-' + card.key">
          <div class="flex items-center justify-between gap-3">
            <h3 [class]="card.nameClass">{{ card.nameKey | transloco }}</h3>
            @if (card.recommended) {
              <span
                data-testid="pricing-recommended"
                class="rounded-md bg-ib-blue/10 px-2.5 py-1 font-mono text-xs uppercase tracking-[0.16em] text-ib-blue"
              >
                {{ 'pricing.recommended' | transloco }}
              </span>
            }
          </div>

          <p class="mt-4 flex items-baseline gap-1.5">
            <span [class]="card.priceClass">{{ card.priceKey | transloco }}</span>
            <span class="text-sm text-text-muted">{{ card.periodKey | transloco }}</span>
          </p>

          <p class="mt-3 text-base leading-relaxed text-text-muted">
            {{ card.taglineKey | transloco }}
          </p>

          <ul class="mt-6 grow space-y-3 border-t border-border pt-6 text-base text-text-primary">
            @for (featureKey of card.featureKeys; track featureKey) {
              <li class="flex items-start gap-3">
                <app-icon name="check" [size]="16" class="mt-1 shrink-0 text-ib-green" />
                <span>{{ featureKey | transloco }}</span>
              </li>
            }
          </ul>

          @if (card.showCta) {
            <a [routerLink]="ctaTarget()" [class]="card.ctaClass">
              {{ card.ctaKey | transloco }}
            </a>
          }
        </article>
      }
    </div>
  `,
})
export class PricingCards {
  /** Plan mis en avant à la place du plan recommandé (contexte gate `/upgrade`). */
  readonly highlightPlan = input<PlanKey>();
  /** `'public'` = landing (CTA inscription) ; `'app'` = /upgrade (carte Solo masquée). */
  readonly context = input<'public' | 'app'>('public');

  protected readonly ctaTarget = computed(() =>
    this.context() === 'app' ? '/settings' : '/auth/register',
  );

  protected readonly cards = computed<readonly PlanCard[]>(() => {
    const highlight = this.highlightPlan();
    const inApp = this.context() === 'app';

    return PRICING_PLANS.filter((plan) => !inApp || plan.key !== 'solo').map((plan) => {
      const emphasized = highlight ? plan.key === highlight : plan.recommended;
      return {
        ...plan,
        nameKey: `pricing.plans.${plan.key}.name`,
        priceKey: `pricing.plans.${plan.key}.price`,
        periodKey: `pricing.plans.${plan.key}.period`,
        taglineKey: `pricing.plans.${plan.key}.tagline`,
        ctaKey: `pricing.plans.${plan.key}.cta`,
        showCta: !inApp || plan.key !== 'solo',
        articleClass: `flex flex-col rounded-lg border ${emphasized ? 'border-ib-blue' : 'border-border'} bg-canvas p-8`,
        nameClass: `font-mono text-xs uppercase tracking-[0.16em] ${emphasized ? 'text-ib-blue' : 'text-text-muted'}`,
        priceClass: `text-4xl font-semibold tracking-tight ${emphasized ? 'text-ib-blue' : 'text-text-primary'}`,
        ctaClass: CTA_BASE + (emphasized ? CTA_PRIMARY : CTA_SECONDARY),
      };
    });
  });
}
