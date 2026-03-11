import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type BarGroup = {
  readonly label: string;
  readonly bars: { readonly value: number; readonly color: string }[];
};

@Component({
  selector: 'app-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" class="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <!-- Grid lines -->
      @for (y of gridLines(); track y) {
        <line [attr.x1]="pad" [attr.y1]="y" [attr.x2]="width - 8" [attr.y2]="y"
              stroke="var(--border)" stroke-width="0.5" stroke-dasharray="3,3" />
      }

      <!-- Y-axis labels -->
      @for (gl of gridLabels(); track gl.y) {
        <text [attr.x]="pad - 4" [attr.y]="gl.y + 3" text-anchor="end"
              fill="var(--text-muted)" font-size="8" font-family="var(--font-mono)">
          {{ gl.label }}
        </text>
      }

      <!-- Bar groups -->
      @for (group of barGroups(); track group.label) {
        @for (bar of group.bars; track $index) {
          <rect [attr.x]="bar.x" [attr.y]="bar.y"
                [attr.width]="bar.w" [attr.height]="bar.h"
                [attr.fill]="bar.color" rx="3" class="transition-all duration-300" />
        }
        <text [attr.x]="group.cx" [attr.y]="height - 4" text-anchor="middle"
              fill="var(--text-muted)" font-size="9" font-family="var(--font-sans)">
          {{ group.label }}
        </text>
      }
    </svg>
  `,
})
export class BarChart {
  readonly data = input.required<BarGroup[]>();

  protected readonly width = 500;
  protected readonly height = 200;
  protected readonly pad = 45;

  private readonly chartArea = computed(() => ({
    left: this.pad,
    right: this.width - 8,
    top: 12,
    bottom: this.height - 22,
  }));

  private readonly maxValue = computed(() => {
    const allVals = this.data().flatMap(g => g.bars.map(b => b.value));
    return Math.max(...allVals, 1);
  });

  protected readonly barGroups = computed(() => {
    const groups = this.data();
    if (!groups.length) return [];
    const { left, right, top, bottom } = this.chartArea();
    const max = this.maxValue();
    const groupWidth = (right - left) / groups.length;
    const barsPerGroup = groups[0]?.bars.length ?? 1;
    const barWidth = Math.min((groupWidth * 0.6) / barsPerGroup, 24);
    const totalBarsWidth = barWidth * barsPerGroup + (barsPerGroup - 1) * 2;

    return groups.map((g, gi) => {
      const groupCenter = left + gi * groupWidth + groupWidth / 2;
      const startX = groupCenter - totalBarsWidth / 2;

      return {
        label: g.label,
        cx: groupCenter,
        bars: g.bars.map((b, bi) => {
          const h = (b.value / max) * (bottom - top);
          return {
            x: startX + bi * (barWidth + 2),
            y: bottom - h,
            w: barWidth,
            h: Math.max(h, 1),
            color: b.color,
          };
        }),
      };
    });
  });

  protected readonly gridLines = computed(() => {
    const { top, bottom } = this.chartArea();
    const count = 4;
    return Array.from({ length: count + 1 }, (_, i) => top + ((bottom - top) / count) * i);
  });

  protected readonly gridLabels = computed(() => {
    const { top, bottom } = this.chartArea();
    const max = this.maxValue();
    const count = 4;

    return Array.from({ length: count + 1 }, (_, i) => {
      const y = top + ((bottom - top) / count) * i;
      const val = max * (1 - i / count);
      return { y, label: val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(0) };
    });
  });
}
