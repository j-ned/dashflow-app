import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { SubStatus } from '@core/admin/admin.types';

const NEUTRAL = 'border-border text-text-muted';
const STATUS_CLASS: Record<NonNullable<SubStatus>, string> = {
  active: 'border-ib-green-20 bg-ib-green-10 text-ib-green',
  trialing: 'border-ib-cyan-20 bg-ib-cyan-10 text-ib-cyan',
  past_due: 'border-ib-red-20 bg-ib-red-10 text-ib-red',
  canceled: NEUTRAL,
  incomplete: 'border-ib-yellow-20 bg-ib-yellow-10 text-ib-yellow',
};

@Component({
  selector: 'app-admin-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  imports: [TranslocoPipe],
  template: `
    @if (status(); as s) {
      <span
        class="inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] font-semibold leading-tight"
        [class]="badgeClass()"
        data-testid="admin-status-badge"
      >
        {{ 'admin.status.' + s | transloco }}
      </span>
    } @else {
      <span class="text-text-muted" aria-hidden="true">—</span>
    }
  `,
})
export class AdminStatusBadge {
  readonly status = input.required<SubStatus>();
  protected readonly badgeClass = computed(() => {
    const s = this.status();
    return s ? (STATUS_CLASS[s] ?? NEUTRAL) : NEUTRAL;
  });
}
