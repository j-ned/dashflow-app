import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { PlanKey } from '@core/admin/admin.types';

const PLAN_CLASS: Record<PlanKey, string> = {
  solo: 'border-border text-text-primary',
  family: 'border-ib-blue-20 bg-ib-blue-10 text-ib-blue',
  family_health: 'border-ib-purple-20 bg-ib-purple-10 text-ib-purple',
};

@Component({
  selector: 'app-admin-plan-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  imports: [TranslocoPipe],
  template: `
    <span
      class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] font-semibold leading-tight"
      [class]="badgeClass()"
      data-testid="admin-plan-badge"
    >
      {{ 'admin.plan.' + plan() | transloco }}
    </span>
  `,
})
export class AdminPlanBadge {
  readonly plan = input.required<PlanKey>();
  protected readonly badgeClass = computed(() => PLAN_CLASS[this.plan()]);
}
