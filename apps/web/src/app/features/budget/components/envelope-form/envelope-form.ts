import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Envelope, EnvelopeType } from '../../domain/models/envelope.model';

type EnvelopeFormShape = {
  name: FormControl<string>;
  type: FormControl<EnvelopeType>;
  balance: FormControl<number>;
  target: FormControl<number | null>;
  color: FormControl<string>;
};

const ENVELOPE_COLORS = [
  '#2aacb8', '#6aab73', '#e5c07b', '#9876aa', '#56a8f5', '#cf8e6d', '#e06c75', '#c77dba',
] as const;

@Component({
  selector: 'app-envelope-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submitForm()">
      <fieldset class="space-y-3">
        <legend class="sr-only">{{ initial() ? 'Modifier enveloppe' : 'Nouvelle enveloppe' }}</legend>

        <div>
          <label for="env-name" class="form-label">
            Nom <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input id="env-name" type="text" formControlName="name" aria-required="true"
                 class="form-input" />
          @if (form.controls.name.touched && form.controls.name.errors?.['required']) {
            <small class="error" role="alert">Le nom est obligatoire.</small>
          }
        </div>

        <div>
          <label for="env-type" class="form-label">
            Type <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <select id="env-type" formControlName="type" aria-required="true"
                  class="form-select">
            <option value="savings">Épargne</option>
            <option value="tax">Impôts</option>
            <option value="equipment">Matériel</option>
            <option value="vacation">Vacances</option>
          </select>
        </div>

        <div>
          <label for="env-balance" class="form-label">Solde initial</label>
          <input id="env-balance" type="number" formControlName="balance" step="0.01" min="0"
                 class="form-input mono" />
          @if (form.controls.balance.touched && form.controls.balance.errors?.['min']) {
            <small class="error" role="alert">Le solde ne peut pas être négatif.</small>
          }
        </div>

        <div>
          <label for="env-target" class="form-label">Objectif</label>
          <input id="env-target" type="number" formControlName="target" step="0.01" min="0"
                 class="form-input mono" />
        </div>

        <div>
          <label class="form-label">Couleur</label>
          <div class="flex gap-2 flex-wrap">
            @for (c of colors; track c) {
              <button type="button"
                      class="h-8 w-8 rounded-full border-2 transition-all"
                      [style.background-color]="c"
                      [class.border-white]="form.controls.color.value === c"
                      [class.border-transparent]="form.controls.color.value !== c"
                      [class.scale-110]="form.controls.color.value === c"
                      (click)="form.controls.color.setValue(c)"
                      [attr.aria-label]="'Couleur ' + c">
              </button>
            }
          </div>
        </div>
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">Annuler</button>
        <button type="submit" [disabled]="form.invalid"
                class="btn-submit" style="background-color: var(--color-ib-green)">
          {{ initial() ? 'Enregistrer' : 'Créer' }}
        </button>
      </footer>
    </form>
  `,
})
export class EnvelopeForm {
  readonly initial = input<Envelope | null>(null);
  readonly submitted = output<Omit<Envelope, 'id'>>();
  readonly cancelled = output<void>();

  protected readonly colors = ENVELOPE_COLORS;

  protected readonly form = new FormGroup<EnvelopeFormShape>({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    type: new FormControl<EnvelopeType>('savings', { nonNullable: true }),
    balance: new FormControl(0, { nonNullable: true, validators: [Validators.min(0)] }),
    target: new FormControl<number | null>(null),
    color: new FormControl('#6aab73', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const data = this.initial();
      if (data) {
        this.form.patchValue({
          name: data.name,
          type: data.type,
          balance: data.balance,
          target: data.target,
          color: data.color,
        });
      } else {
        this.form.reset();
      }
    });
  }

  protected submitForm() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.submitted.emit({
      name: v.name,
      type: v.type,
      balance: v.balance,
      target: v.target,
      color: v.color,
    });
  }
}
