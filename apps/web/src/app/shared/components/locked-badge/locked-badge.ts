import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';
import type { Feature, PlanKey } from '@core/entitlements/entitlement.types';
import { FEATURE_PLAN } from '@core/entitlements/feature-plan';

@Component({
  selector: 'app-locked-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  imports: [RouterLink, Icon, TranslocoPipe],
  template: `
    <a
      routerLink="/upgrade"
      [queryParams]="queryParams()"
      class="badge"
      [attr.aria-label]="'entitlement.badge.aria' | transloco"
    >
      <app-icon name="lock" size="12" class="shrink-0" />
      <span class="truncate">{{ 'entitlement.badge.' + requiredPlan() | transloco }}</span>
    </a>
  `,
  styles: `
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.125rem 0.5rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--color-ib-yellow-20);
      background: var(--color-ib-yellow-10);
      color: var(--color-ib-yellow);
      font-size: 0.6875rem;
      font-weight: 600;
      line-height: 1.2;
      white-space: nowrap;
    }

    .badge:focus-visible {
      outline: 2px solid var(--color-ib-yellow);
      outline-offset: 2px;
    }

    @media (hover: hover) {
      .badge:hover {
        background: var(--color-ib-yellow-20);
      }
    }
  `,
})
export class LockedBadge {
  readonly feature = input.required<Feature>();
  /** Override optionnel ; par défaut le plan requis est dérivé de la feature. */
  readonly planKey = input<PlanKey>();

  /** Plan minimal qui débloque la feature (consommé par le libellé et le lien). */
  protected readonly requiredPlan = computed<PlanKey>(
    () => this.planKey() ?? FEATURE_PLAN[this.feature()],
  );

  protected readonly queryParams = computed(() => ({
    feature: this.feature(),
    planKey: this.requiredPlan(),
  }));
}
