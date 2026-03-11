import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type DonutSlice = { readonly label: string; readonly value: number; readonly color: string };

@Component({
  selector: 'app-donut-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex items-center gap-6">
      <svg viewBox="0 0 120 120" class="w-32 h-32 shrink-0">
        @for (arc of arcs(); track arc.label) {
          <circle cx="60" cy="60" r="48" fill="none"
                  [attr.stroke]="arc.color" stroke-width="22"
                  [attr.stroke-dasharray]="arc.dashArray"
                  [attr.stroke-dashoffset]="arc.dashOffset"
                  stroke-linecap="round"
                  class="transition-all duration-500" />
        }
        <text x="60" y="56" text-anchor="middle" fill="var(--text-primary)"
              font-size="16" font-weight="700" font-family="var(--font-mono)">
          {{ centerLabel() }}
        </text>
        <text x="60" y="70" text-anchor="middle" fill="var(--text-muted)"
              font-size="8" font-family="var(--font-sans)">
          {{ centerSub() }}
        </text>
      </svg>

      <div class="flex-1 space-y-2 min-w-0">
        @for (item of legendItems(); track item.label) {
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 rounded-full shrink-0" [style.background-color]="item.color"></div>
            <span class="text-xs text-text-muted truncate flex-1">{{ item.label }}</span>
            <span class="text-xs font-mono font-medium text-text-primary shrink-0">{{ item.display }}</span>
          </div>
        }
      </div>
    </div>
  `,
})
export class DonutChart {
  readonly data = input.required<DonutSlice[]>();
  readonly centerLabel = input('');
  readonly centerSub = input('');

  private readonly circumference = 2 * Math.PI * 48;

  protected readonly arcs = computed(() => {
    const slices = this.data();
    const total = slices.reduce((s, d) => s + d.value, 0);
    if (total === 0) return [];
    const circ = this.circumference;
    const gap = 3;
    let offset = circ * 0.25; // start from top

    return slices.map(s => {
      const pct = s.value / total;
      const segLen = circ * pct - gap;
      const arc = {
        label: s.label,
        color: s.color,
        dashArray: `${Math.max(segLen, 1)} ${circ - Math.max(segLen, 1)}`,
        dashOffset: String(-offset),
      };
      offset += circ * pct;
      return arc;
    });
  });

  protected readonly legendItems = computed(() => {
    const total = this.data().reduce((s, d) => s + d.value, 0);
    return this.data().map(s => ({
      label: s.label,
      color: s.color,
      display: `${s.value.toFixed(0)}€ (${total > 0 ? ((s.value / total) * 100).toFixed(0) : 0}%)`,
    }));
  });
}
