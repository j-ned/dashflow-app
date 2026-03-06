import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Loan, LoanDirection } from '../../domain/models/loan.model';

type LoanFormShape = {
  person: FormControl<string>;
  amount: FormControl<number>;
  description: FormControl<string>;
  date: FormControl<string>;
  dueDate: FormControl<string>;
};

@Component({
  selector: 'app-loan-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submitForm()">
      <fieldset class="space-y-3">
        <legend class="sr-only">{{ initial() ? 'Modifier' : (direction() === 'lent' ? 'Nouveau prêt' : 'Nouvel emprunt') }}</legend>

        <div>
          <label for="loan-person" class="form-label">
            Personne <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input id="loan-person" type="text" formControlName="person" aria-required="true"
                 class="form-input" />
          @if (form.controls.person.touched && form.controls.person.errors?.['required']) {
            <small class="error" role="alert">Le nom de la personne est obligatoire.</small>
          }
        </div>

        <div>
          <label for="loan-amount" class="form-label">
            Montant <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input id="loan-amount" type="number" formControlName="amount" step="0.01" min="0.01" aria-required="true"
                 class="form-input mono" />
          @if (form.controls.amount.touched) {
            @if (form.controls.amount.errors?.['required']) {
              <small class="error" role="alert">Le montant est obligatoire.</small>
            } @else if (form.controls.amount.errors?.['min']) {
              <small class="error" role="alert">Le montant doit être supérieur à 0.</small>
            }
          }
        </div>

        <div>
          <label for="loan-description" class="form-label">Description</label>
          <input id="loan-description" type="text" formControlName="description"
                 class="form-input" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="loan-date" class="form-label">
              Date <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <input id="loan-date" type="date" formControlName="date" aria-required="true"
                   class="form-input" />
            @if (form.controls.date.touched && form.controls.date.errors?.['required']) {
              <small class="error" role="alert">La date est obligatoire.</small>
            }
          </div>
          <div>
            <label for="loan-due-date" class="form-label">Échéance</label>
            <input id="loan-due-date" type="date" formControlName="dueDate"
                   class="form-input" />
          </div>
        </div>
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">Annuler</button>
        <button type="submit" [disabled]="form.invalid"
                class="btn-submit"
                [style.background-color]="direction() === 'lent' ? 'var(--color-ib-blue)' : 'var(--color-ib-orange)'">
          {{ initial() ? 'Enregistrer' : (direction() === 'lent' ? 'Prêter' : 'Emprunter') }}
        </button>
      </footer>
    </form>
  `,
})
export class LoanForm {
  readonly direction = input.required<LoanDirection>();
  readonly initial = input<Loan | null>(null);
  readonly submitted = output<Omit<Loan, 'id'>>();
  readonly cancelled = output<void>();

  protected readonly form = new FormGroup<LoanFormShape>({
    person: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    amount: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0.01)] }),
    description: new FormControl('', { nonNullable: true }),
    date: new FormControl(new Date().toISOString().slice(0, 10), { nonNullable: true, validators: [Validators.required] }),
    dueDate: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const data = this.initial();
      if (data) {
        this.form.patchValue({
          person: data.person,
          amount: data.amount,
          description: data.description,
          date: data.date,
          dueDate: data.dueDate ?? '',
        });
      } else {
        this.form.reset();
      }
    });
  }

  protected submitForm() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const init = this.initial();
    this.submitted.emit({
      person: v.person,
      direction: this.direction(),
      amount: v.amount,
      remaining: init ? init.remaining : v.amount,
      description: v.description,
      date: v.date,
      dueDate: v.dueDate || null,
    });
  }
}
