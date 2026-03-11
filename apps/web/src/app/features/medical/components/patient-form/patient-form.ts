import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
import { Patient } from '../../domain/models/patient.model';

type PatientFormShape = {
  firstName: FormControl<string>;
  lastName: FormControl<string>;
  birthDate: FormControl<string>;
  notes: FormControl<string>;
};

@Component({
  selector: 'app-patient-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submitForm()">
      <fieldset class="space-y-3">
        <legend class="sr-only">{{ initial() ? 'Modifier patient' : 'Nouveau patient' }}</legend>

        <div>
          <label for="patient-firstName" class="form-label">
            Prénom <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input id="patient-firstName" type="text" formControlName="firstName" aria-required="true"
                 class="form-input" />
          @if (form.controls.firstName.touched && form.controls.firstName.errors?.['required']) {
            <small class="error" role="alert">Le prénom est obligatoire.</small>
          }
        </div>

        <div>
          <label for="patient-lastName" class="form-label">
            Nom <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input id="patient-lastName" type="text" formControlName="lastName" aria-required="true"
                 class="form-input" />
          @if (form.controls.lastName.touched && form.controls.lastName.errors?.['required']) {
            <small class="error" role="alert">Le nom est obligatoire.</small>
          }
        </div>

        <div>
          <label for="patient-birthDate" class="form-label">
            Date de naissance <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input id="patient-birthDate" type="date" formControlName="birthDate" aria-required="true"
                 class="form-input" />
          @if (form.controls.birthDate.touched && form.controls.birthDate.errors?.['required']) {
            <small class="error" role="alert">La date de naissance est obligatoire.</small>
          }
        </div>

        <div>
          <label for="patient-notes" class="form-label">Notes</label>
          <textarea id="patient-notes" formControlName="notes" rows="3"
                    class="form-input"></textarea>
        </div>
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">Annuler</button>
        <button type="submit" [disabled]="isInvalid()"
                class="btn-submit" style="background-color: var(--color-ib-purple)">
          {{ initial() ? 'Enregistrer' : 'Créer' }}
        </button>
      </footer>
    </form>
  `,
})
export class PatientForm {
  readonly initial = input<Patient | null>(null);
  readonly submitted = output<Omit<Patient, 'id'>>();
  readonly cancelled = output<void>();

  protected readonly form = new FormGroup<PatientFormShape>({
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    birthDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    notes: new FormControl('', { nonNullable: true }),
  });

  protected readonly isInvalid = toSignal(
    this.form.statusChanges.pipe(map(() => this.form.invalid)),
    { initialValue: this.form.invalid },
  );

  constructor() {
    effect(() => {
      const data = this.initial();
      if (data) {
        this.form.patchValue({
          firstName: data.firstName,
          lastName: data.lastName,
          birthDate: data.birthDate,
          notes: data.notes ?? '',
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
      firstName: v.firstName,
      lastName: v.lastName,
      birthDate: v.birthDate,
      notes: v.notes || null,
    });
  }
}
