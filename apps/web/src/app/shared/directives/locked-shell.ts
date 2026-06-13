import { ChangeDetectionStrategy, Component, input, type TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { LockedBadge } from '@shared/components/locked-badge/locked-badge';
import type { Feature, PlanKey } from '@core/entitlements/entitlement.types';

@Component({
  selector: 'app-locked-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative inline-flex items-center gap-2' },
  imports: [NgTemplateOutlet, LockedBadge],
  template: `
    <div aria-disabled="true" class="opacity-50 pointer-events-none">
      <ng-container [ngTemplateOutlet]="content()" />
    </div>
    <app-locked-badge [feature]="feature()" [planKey]="planKey()" />
  `,
})
export class LockedShell {
  readonly content = input.required<TemplateRef<unknown>>();
  readonly feature = input.required<Feature>();
  readonly planKey = input<PlanKey>();
}
