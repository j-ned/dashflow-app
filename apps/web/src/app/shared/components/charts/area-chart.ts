import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type AreaChartPoint = { readonly label: string; readonly value: number };

@Component({
  selector: 'app-area-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" class="w-full h-full" preserveAspectRatio="none">
      <defs>
        <!-- noinspection HtmlUnknownAttribute -->
        <linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" [attr.stop-color]="color()" stop-opacity="0.3" />
          <stop offset="100%" [attr.stop-color]="color()" stop-opacity="0.02" />
        </linearGradient>
      </defs>

      <!-- Grid lines -->
      @for (y of gridLines(); track y) {
        <line [attr.x1]="pad" [attr.y1]="y" [attr.x2]="width - pad" [attr.y2]="y"
              stroke="var(--border)" stroke-width="0.5" stroke-dasharray="3,3" />
      }

      <!-- Area fill -->
      <path [attr.d]="areaPath()" [attr.fill]="'url(#' + gradientId + ')'" />

      <!-- Line -->
      <path [attr.d]="linePath()" fill="none" [attr.stroke]="color()"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />

      <!-- Dots + labels -->
      @for (pt of plotPoints(); track pt.x) {
        <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="3.5"
                [attr.fill]="color()" stroke="var(--bg-surface)" stroke-width="2" />
        <text [attr.x]="pt.x" [attr.y]="height - 4" text-anchor="middle"
              fill="var(--text-muted)" font-size="9" font-family="var(--font-sans)">
          {{ pt.label }}
        </text>
      }

      <!-- Y-axis labels -->
      @for (gl of gridLabels(); track gl.y) {
        <text [attr.x]="pad - 4" [attr.y]="gl.y + 3" text-anchor="end"
              fill="var(--text-muted)" font-size="8" font-family="var(--font-mono)">
          {{ gl.label }}
        </text>
      }
    </svg>
  `,
})
export class AreaChart {
  readonly data = input.required<AreaChartPoint[]>();
  readonly color = input('var(--color-ib-green)');

  protected readonly width = 500;
  protected readonly height = 200;
  protected readonly pad = 45;
  protected readonly gradientId = 'area-grad-' + Math.random().toString(36).slice(2, 8);

  private readonly chartArea = computed(() => {
    const topPad = 16;
    const bottomPad = 22;
    return {
      left: this.pad,
      right: this.width - this.pad / 2,
      top: topPad,
      bottom: this.height - bottomPad,
    };
  });

  private readonly minMax = computed(() => {
    const vals = this.data().map(d => d.value);
    const min = Math.min(...vals, 0);
    const max = Math.max(...vals, 1);
    const range = max - min || 1;
    return { min: min - range * 0.05, max: max + range * 0.1, range: range * 1.15 };
  });

  protected readonly plotPoints = computed(() => {
    const pts = this.data();
    if (pts.length === 0) return [];
    const { left, right, top, bottom } = this.chartArea();
    const { min, range } = this.minMax();
    const step = pts.length > 1 ? (right - left) / (pts.length - 1) : 0;

    return pts.map((p, i) => ({
      x: left + i * step,
      y: bottom - ((p.value - min) / range) * (bottom - top),
      label: p.label,
      value: p.value,
    }));
  });

  protected readonly linePath = computed(() => {
    const pts = this.plotPoints();
    if (pts.length === 0) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  });

  protected readonly areaPath = computed(() => {
    const pts = this.plotPoints();
    if (pts.length === 0) return '';
    const { bottom } = this.chartArea();
    const line = this.linePath();
    return `${line} L${pts[pts.length - 1].x},${bottom} L${pts[0].x},${bottom} Z`;
  });

  protected readonly gridLines = computed(() => {
    const { top, bottom } = this.chartArea();
    const count = 4;
    const step = (bottom - top) / count;
    return Array.from({ length: count + 1 }, (_, i) => top + i * step);
  });

  protected readonly gridLabels = computed(() => {
    const { top, bottom } = this.chartArea();
    const { min, range } = this.minMax();
    const count = 4;
    const step = (bottom - top) / count;

    return Array.from({ length: count + 1 }, (_, i) => {
      const y = top + i * step;
      const val = min + range * (1 - i / count);
      return { y, label: val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(0) };
    });
  });
}
