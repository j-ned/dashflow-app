import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon, type IconName } from '@shared/components/icon/icon';

export type ForecastView = {
  readonly label: string;
  readonly icon: IconName;
  readonly color: string;
  readonly message: string;
  readonly detail: string;
};

@Component({
  selector: 'app-analytics-forecast-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  // display:block (pas 'contents') : section en flux vertical de page — 'contents' annulerait les marges du host et casserait l'espacement du parent
  host: { class: 'block' },
  template: `
    <section class="rounded-xl border border-border bg-surface overflow-hidden">
      <div class="flex items-center gap-2 px-5 py-3 bg-ib-purple/5 border-b border-border/50">
        <app-icon name="trending-up" size="16" class="text-ib-purple" />
        <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ib-purple">
          {{ title() }}
        </h3>
      </div>
      @if (forecasts().length > 0) {
        <div class="divide-y divide-border/30">
          @for (f of forecasts(); track f.label) {
            <div class="flex items-start gap-4 px-5 py-4 hover:bg-hover/30 transition-colors">
              <div
                class="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                [style.background-color]="f.color + '15'"
              >
                <app-icon [name]="f.icon" size="18" [style.color]="f.color" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-text-primary">{{ f.label }}</p>
                <p class="text-sm text-text-muted mt-0.5">{{ f.message }}</p>
                <p class="text-[11px] text-text-muted mt-1">{{ f.detail }}</p>
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="text-center py-12">
          <app-icon name="trending-up" size="32" class="text-text-muted/20 mx-auto mb-2" />
          <p class="text-sm text-text-muted">{{ emptyText() }}</p>
          <p class="text-xs text-text-muted mt-1">
            {{ emptyHint() }}
          </p>
        </div>
      }
    </section>
  `,
})
export class AnalyticsForecastList {
  readonly forecasts = input.required<ForecastView[]>();
  readonly title = input.required<string>();
  readonly emptyText = input.required<string>();
  readonly emptyHint = input.required<string>();
}
