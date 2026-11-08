import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';
import { RecurringEntryType } from '../../../domain/models/recurring-entry.model';

export type AddRequest = {
  readonly type: RecurringEntryType;
  readonly transferMode: 'recurring' | 'one_time';
};

type AddOption = AddRequest & { readonly labelKey: string };

const OPTIONS: readonly AddOption[] = [
  { type: 'income', transferMode: 'recurring', labelKey: 'budget.bankAccount.add.income' },
  { type: 'expense', transferMode: 'recurring', labelKey: 'budget.bankAccount.add.expense' },
  {
    type: 'annual_expense',
    transferMode: 'recurring',
    labelKey: 'budget.bankAccount.add.annualExpense',
  },
  { type: 'spending', transferMode: 'recurring', labelKey: 'budget.bankAccount.add.spending' },
  // Le formulaire laisse basculer ponctuel ↔ récurrent ; on part du cas le plus fréquent ici.
  { type: 'transfer', transferMode: 'one_time', labelKey: 'budget.bankAccount.add.transfer' },
];

/**
 * Point d'entrée unique pour créer une opération (motif « disclosure » : un bouton qui déplie une
 * liste de boutons). Remplace les boutons « + » propres à chaque bloc.
 */
@Component({
  selector: 'app-bank-add-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, Icon],
  host: {
    class: 'relative inline-block',
    '(keydown.escape)': 'closeAndRefocus()',
    '(document:click)': 'closeIfOutside($event)',
  },
  template: `
    <button
      #toggle
      type="button"
      data-testid="add-toggle"
      class="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-ib-blue px-3 py-1.5 text-sm font-medium text-canvas shadow-sm transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      aria-controls="bank-add-options"
      [attr.aria-expanded]="isOpen()"
      (click)="isOpen.set(!isOpen())"
    >
      <app-icon name="plus" size="14" />
      {{ 'budget.bankAccount.add.button' | transloco }}
      <app-icon name="chevron-down" size="12" />
    </button>
    @if (isOpen()) {
      <ul
        id="bank-add-options"
        class="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-border bg-surface p-1 shadow-lg"
      >
        @for (option of options; track option.type) {
          <li>
            <button
              type="button"
              class="w-full rounded-md px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-none"
              [attr.data-testid]="'add-' + option.type"
              (click)="choose(option)"
            >
              {{ option.labelKey | transloco }}
            </button>
          </li>
        }
      </ul>
    }
  `,
})
export class BankAddMenu {
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly add = output<AddRequest>();

  private readonly _toggle = viewChild.required<ElementRef<HTMLButtonElement>>('toggle');

  protected readonly options = OPTIONS;
  protected readonly isOpen = signal(false);

  protected choose(option: AddOption): void {
    this.isOpen.set(false);
    this.add.emit({ type: option.type, transferMode: option.transferMode });
  }

  protected closeAndRefocus(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this._toggle().nativeElement.focus();
  }

  protected closeIfOutside(event: MouseEvent): void {
    if (event.target instanceof Node && this._host.nativeElement.contains(event.target)) return;
    this.isOpen.set(false);
  }
}
