import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Icon, type IconName } from '@shared/components/icon/icon';

export type KpiCard = {
  readonly label: string;
  readonly icon: IconName;
  readonly iconBg: string;
  readonly iconColor: string;
  readonly value: number;
  readonly valueColor: string;
  readonly sub: string | null;
};

@Component({
  selector: 'app-analytics-kpi-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, Icon],
  // `block` (et non `contents`) pour que le `space-y-6` du parent espace bien le titre et les KPIs.
  host: { class: 'block' },
  template: `
    <section class="grid grid-cols-2 lg:grid-cols-4 gap-4" [attr.aria-label]="ariaLabel()">
      @for (kpi of kpis(); track kpi.label) {
        <div class="rounded-xl border border-border bg-surface p-4">
          <div class="flex items-center gap-2 mb-2">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg" [class]="kpi.iconBg">
              <app-icon [name]="kpi.icon" size="16" [class]="kpi.iconColor" />
            </div>
            <span class="text-[11px] text-text-muted uppercase tracking-wider">{{
              kpi.label
            }}</span>
          </div>
          <p class="text-xl font-mono font-bold" [class]="kpi.valueColor">
            {{ kpi.value | number: '1.0-0' }}<span class="text-sm ml-0.5">&euro;</span>
          </p>
          @if (kpi.sub) {
            <p class="text-[10px] text-text-muted mt-1">{{ kpi.sub }}</p>
          }
        </div>
      }
    </section>
  `,
})
export class AnalyticsKpiGrid {
  readonly kpis = input.required<KpiCard[]>();
  readonly ariaLabel = input.required<string>();
}
