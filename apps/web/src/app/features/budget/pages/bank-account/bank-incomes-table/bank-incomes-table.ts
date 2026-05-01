import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Icon } from '@shared/components/icon/icon';
import { RecurringEntry } from '../../../domain/models/recurring-entry.model';

@Component({
  selector: 'app-bank-incomes-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, DatePipe, Icon],
  host: { class: 'block' },
  template: `
    <section class="rounded-xl border border-border bg-surface overflow-hidden">
      <div class="flex items-center justify-between px-5 py-3 bg-ib-green/5 border-b border-border/50">
        <div class="flex items-center gap-2">
          <app-icon name="trending-up" size="16" class="text-ib-green" />
          <h3 class="text-xs font-semibold uppercase tracking-wider text-ib-green">Revenus</h3>
        </div>
        <button type="button"
                class="inline-flex items-center gap-1 rounded-lg bg-ib-green min-h-8 px-3 py-1.5 text-xs font-medium text-canvas hover:bg-ib-green/90 transition-colors shadow-sm"
                (click)="create.emit()">
          <app-icon name="plus" size="12" /> Revenu
        </button>
      </div>
      @if (incomes().length > 0) {
        <div class="divide-y divide-border/30">
          @for (entry of incomes(); track entry.id) {
            <div class="group flex items-center justify-between px-5 py-3.5 hover:bg-ib-green/3 transition-colors">
              <div class="flex items-center gap-3">
                <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-ib-green/10 text-ib-green text-xs font-bold shrink-0">
                  @if (entry.dayOfMonth) { {{ entry.dayOfMonth }} } @else { — }
                </div>
                <div>
                  <p class="text-sm font-semibold text-text-primary">{{ entry.label }}</p>
                  <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                    @if (entry.category) {
                      <span class="inline-flex items-center rounded-md bg-raised px-1.5 py-0.5 text-[10px] font-medium text-text-muted">{{ entry.category }}</span>
                    }
                    @if (entry.date) {
                      <span class="text-[11px] text-text-muted">{{ entry.date | date:'dd/MM/yyyy' }}</span>
                    }
                    @if (memberMap().get(entry.memberId ?? '')?.name; as mName) {
                      <span class="inline-flex items-center gap-1 text-[11px] text-text-muted">
                        @if (memberMap().get(entry.memberId ?? '')?.color; as mc) {
                          <span class="inline-block h-2 w-2 rounded-full shrink-0" [style.background-color]="mc"></span>
                        }
                        {{ mName }}
                      </span>
                    }
                    @if (entry.payslipKey) {
                      <button type="button"
                              class="inline-flex items-center gap-0.5 rounded-md bg-ib-green/10 px-1.5 py-0.5 text-[10px] font-medium text-ib-green hover:bg-ib-green/20 transition-colors cursor-pointer"
                              (click)="openPayslip.emit(entry.id); $event.stopPropagation()">
                        <app-icon name="file-text" size="10" /> Fiche de paie
                      </button>
                    }
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-lg font-mono font-bold text-ib-green">+{{ entry.amount | number:'1.2-2' }}<span class="text-sm">&euro;</span></span>
                <div class="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button type="button"
                          class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-yellow hover:border-ib-yellow/30 transition-colors"
                          [title]="'Modifier — ' + entry.label"
                          [attr.aria-label]="'Modifier ' + entry.label"
                          (click)="edit.emit(entry)">
                    <app-icon name="pencil" size="13" />
                  </button>
                  <button type="button"
                          class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors"
                          [title]="'Supprimer — ' + entry.label"
                          [attr.aria-label]="'Supprimer ' + entry.label"
                          (click)="delete.emit(entry.id)">
                    <app-icon name="trash" size="13" />
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="px-5 py-8 text-center">
          <app-icon name="trending-up" size="32" class="text-text-muted/20 mx-auto mb-2" />
          <p class="text-sm text-text-muted">Ajoutez votre salaire ou autres revenus mensuels</p>
        </div>
      }
    </section>
  `,
})
export class BankIncomesTable {
  readonly incomes = input.required<RecurringEntry[]>();
  readonly memberMap = input.required<Map<string, { name: string; color: string }>>();
  readonly selectedAccountId = input.required<string | null>();

  readonly create = output<void>();
  readonly edit = output<RecurringEntry>();
  readonly delete = output<string>();
  readonly openPayslip = output<string>();
}
