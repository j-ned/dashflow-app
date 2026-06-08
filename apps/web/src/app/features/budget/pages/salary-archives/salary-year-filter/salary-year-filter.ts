import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-salary-year-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  host: { class: 'flex flex-wrap items-center gap-2' },
  template: `
    <span class="text-xs font-medium text-text-muted">{{
      'budget.salaryArchive.filterYear' | transloco
    }}</span>
    <button
      type="button"
      class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors"
      [class.border-ib-cyan]="selected() === null"
      [class.bg-ib-cyan]="selected() === null"
      [class.text-canvas]="selected() === null"
      [class.border-border]="selected() !== null"
      [class.text-text-muted]="selected() !== null"
      (click)="selectYear.emit(null)"
    >
      {{ 'budget.salaryArchive.allYears' | transloco }}
    </button>
    @for (year of years(); track year) {
      <button
        type="button"
        class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        [class.border-ib-cyan]="selected() === year"
        [class.bg-ib-cyan]="selected() === year"
        [class.text-canvas]="selected() === year"
        [class.border-border]="selected() !== year"
        [class.text-text-muted]="selected() !== year"
        (click)="selectYear.emit(year)"
      >
        {{ year }}
      </button>
    }
  `,
})
export class SalaryYearFilter {
  readonly years = input.required<string[]>();
  readonly selected = input.required<string | null>();
  readonly selectYear = output<string | null>();
}
