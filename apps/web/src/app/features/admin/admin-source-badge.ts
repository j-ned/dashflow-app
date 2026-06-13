import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { PlanSource } from '@core/admin/admin.types';

const SOURCE_CLASS: Record<PlanSource, string> = {
  stripe: 'border-ib-blue-20 bg-ib-blue-10 text-ib-blue',
  admin: 'border-ib-yellow-20 bg-ib-yellow-10 text-ib-yellow',
  free: 'border-border text-text-muted',
};

@Component({
  selector: 'app-admin-source-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  imports: [TranslocoPipe],
  template: `
    <span
      class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] font-semibold leading-tight"
      [class]="badgeClass()"
      data-testid="admin-source-badge"
    >
      {{ 'admin.source.' + source() | transloco }}
    </span>
  `,
})
export class AdminSourceBadge {
  readonly source = input.required<PlanSource>();
  protected readonly badgeClass = computed(() => SOURCE_CLASS[this.source()]);
}
