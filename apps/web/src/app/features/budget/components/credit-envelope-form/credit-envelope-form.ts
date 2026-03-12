import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
import { BankAccount } from '../../domain/models/bank-account.model';

type CreditFormShape = {
  amount: FormControl<number>;
  date: FormControl<string>;
  accountId: FormControl<string>;
};

@Component({
  selector: 'app-credit-envelope-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submitForm()">
      <fieldset class="space-y-3">
        <legend class="sr-only">Créditer / Débiter</legend>

        <div>
          <label for="credit-amount" class="form-label">
            Montant <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <p class="text-xs mb-2" style="color: var(--color-text-muted)">Positif pour créditer, négatif pour débiter</p>
          <input id="credit-amount" type="number" formControlName="amount" step="0.01" aria-required="true"
                 class="form-input mono" />
          @if (form.controls.amount.touched && form.controls.amount.errors?.['required']) {
            <small class="error" role="alert">Le montant est obligatoire.</small>
          }
        </div>

        <div>
          <label for="credit-date" class="form-label">Date</label>
          <input id="credit-date" type="date" formControlName="date" class="form-input" />
        </div>

        @if (accounts().length > 0) {
          <div>
            <label for="credit-account" class="form-label">Decompter du compte</label>
            <select id="credit-account" formControlName="accountId" class="form-select">
              <option value="">Ne pas decompter</option>
              @for (acc of accounts(); track acc.id) {
                <option [value]="acc.id">{{ acc.name }}</option>
              }
            </select>
            <p class="text-xs mt-1" style="color: var(--color-text-muted)">Creera une depense sur le compte selectionne</p>
          </div>
        }
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">Annuler</button>
        <button type="submit" [disabled]="isInvalid()"
                class="btn-submit" style="background-color: var(--color-ib-blue)">
          Valider
        </button>
      </footer>
    </form>
  `,
})
export class CreditEnvelopeForm {
  readonly accounts = input<BankAccount[]>([]);
  readonly submitted = output<{ amount: number; date: string; accountId: string | null }>();
  readonly cancelled = output<void>();

  protected readonly form = new FormGroup<CreditFormShape>({
    amount: new FormControl(0, { nonNullable: true, validators: [Validators.required] }),
    date: new FormControl(new Date().toISOString().slice(0, 10), { nonNullable: true }),
    accountId: new FormControl('', { nonNullable: true }),
  });

  protected readonly isInvalid = toSignal(
    this.form.statusChanges.pipe(map(() => this.form.invalid)),
    { initialValue: this.form.invalid },
  );

  protected submitForm() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.submitted.emit({
      amount: v.amount,
      date: v.date,
      accountId: v.accountId || null,
    });
    this.form.reset({ amount: 0, date: new Date().toISOString().slice(0, 10), accountId: '' });
  }
}
