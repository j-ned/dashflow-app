import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import type { AdminMetrics } from '@core/admin/admin.types';

@Component({
  selector: 'app-admin-metrics-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `block` (et non `contents`) pour que la marge passée par le parent (mb-8) s'applique :
  // un display:contents annule les marges → le bandeau collerait à la recherche.
  host: { class: 'block' },
  imports: [DecimalPipe, TranslocoPipe],
  template: `
    @if (metrics(); as m) {
      <dl
        class="flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-border bg-surface p-4"
        data-testid="admin-metrics-bar"
      >
        <div class="flex flex-col">
          <dt class="font-mono text-xs uppercase tracking-[0.18em] text-text-muted">
            {{ 'admin.metrics.totalUsers' | transloco }}
          </dt>
          <dd
            class="text-lg font-semibold text-text-primary tabular-nums"
            data-testid="metric-total"
          >
            {{ m.totalUsers }}
          </dd>
        </div>

        <div class="flex flex-col">
          <dt class="font-mono text-xs uppercase tracking-[0.18em] text-text-muted">
            {{ 'admin.metrics.mrr' | transloco }}
          </dt>
          <dd class="text-lg font-semibold text-text-primary tabular-nums" data-testid="metric-mrr">
            {{ m.mrr | number: '1.2-2' }} €
          </dd>
        </div>

        <div class="flex flex-col">
          <dt class="font-mono text-xs uppercase tracking-[0.18em] text-text-muted">
            {{ 'admin.metrics.active' | transloco }}
          </dt>
          <dd class="text-lg font-semibold text-text-primary tabular-nums">
            {{ m.activeSubscriptions }}
          </dd>
        </div>

        <div class="flex flex-col">
          <dt class="font-mono text-xs uppercase tracking-[0.18em] text-text-muted">
            {{ 'admin.metrics.trialing' | transloco }}
          </dt>
          <dd class="text-lg font-semibold text-text-primary tabular-nums">{{ m.trialing }}</dd>
        </div>

        <div class="flex flex-col">
          <dt
            class="font-mono text-xs uppercase tracking-[0.18em]"
            [class]="pastDueHighlighted() ? 'text-ib-red' : 'text-text-muted'"
          >
            {{ 'admin.metrics.pastDue' | transloco }}
          </dt>
          <dd
            class="text-lg font-semibold tabular-nums"
            [class]="pastDueHighlighted() ? 'text-ib-red' : 'text-text-primary'"
            data-testid="metric-past-due"
          >
            {{ m.pastDue }}
            @if (pastDueHighlighted()) {
              <span class="text-xs font-medium">{{
                'admin.metrics.pastDueAttention' | transloco
              }}</span>
            }
          </dd>
        </div>

        <div class="flex flex-col">
          <dt class="font-mono text-xs uppercase tracking-[0.18em] text-text-muted">
            {{ 'admin.metrics.byPlan.solo' | transloco }}
          </dt>
          <dd class="text-lg font-semibold text-text-primary tabular-nums">{{ m.byPlan.solo }}</dd>
        </div>

        <div class="flex flex-col">
          <dt class="font-mono text-xs uppercase tracking-[0.18em] text-text-muted">
            {{ 'admin.metrics.byPlan.family' | transloco }}
          </dt>
          <dd class="text-lg font-semibold text-text-primary tabular-nums">
            {{ m.byPlan.family }}
          </dd>
        </div>

        <div class="flex flex-col">
          <dt class="font-mono text-xs uppercase tracking-[0.18em] text-text-muted">
            {{ 'admin.metrics.byPlan.familyHealth' | transloco }}
          </dt>
          <dd class="text-lg font-semibold text-text-primary tabular-nums">
            {{ m.byPlan.family_health }}
          </dd>
        </div>
      </dl>
    }
  `,
})
export class AdminMetricsBar {
  readonly metrics = input.required<AdminMetrics | null>();
  protected readonly pastDueHighlighted = computed(() => (this.metrics()?.pastDue ?? 0) > 0);
}
