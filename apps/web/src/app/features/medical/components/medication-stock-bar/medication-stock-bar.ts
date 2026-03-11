import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-medication-stock-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let days = daysRemaining();
    @let alert = alertDaysBefore();
    @let maxDays = days > 90 ? days : 90;
    @let pct = (days / maxDays) * 100;
    <div class="h-4 rounded-full bg-hover overflow-hidden">
      <div class="h-full rounded-full transition-all duration-300 flex items-center justify-end pr-2"
           [style.width.%]="pct"
           [class.bg-ib-green]="days > alert * 2"
           [class.bg-ib-orange]="days > alert && days <= alert * 2"
           [class.bg-ib-red]="days <= alert">
        @if (pct > 15) {
          <span class="text-[10px] font-mono font-medium text-white">{{ days }}j</span>
        }
      </div>
    </div>
    @if (pct <= 15) {
      <span class="text-[10px] font-mono text-ib-red mt-0.5">{{ days }}j</span>
    }
  `,
})
export class MedicationStockBar {
  readonly daysRemaining = input.required<number>();
  readonly alertDaysBefore = input(7);
}
