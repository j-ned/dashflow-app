import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { formInvalid } from '@shared/forms/form-invalid';
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
  imports: [ReactiveFormsModule, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submitForm()">
      <fieldset class="space-y-3">
        <legend class="sr-only">
          {{
            (initial() ? 'medical.patient.form.legendEdit' : 'medical.patient.form.legendCreate')
              | transloco
          }}
        </legend>

        <div>
          <label for="patient-firstName" class="form-label">
            {{ 'medical.patient.form.firstName' | transloco }}
            <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input
            id="patient-firstName"
            type="text"
            formControlName="firstName"
            aria-required="true"
            class="form-input"
          />
          @if (form.controls.firstName.touched && form.controls.firstName.errors?.['required']) {
            <small class="error" role="alert">{{
              'medical.patient.form.firstNameRequired' | transloco
            }}</small>
          }
        </div>

        <div>
          <label for="patient-lastName" class="form-label">
            {{ 'medical.patient.form.lastName' | transloco }}
            <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input
            id="patient-lastName"
            type="text"
            formControlName="lastName"
            aria-required="true"
            class="form-input"
          />
          @if (form.controls.lastName.touched && form.controls.lastName.errors?.['required']) {
            <small class="error" role="alert">{{
              'medical.patient.form.lastNameRequired' | transloco
            }}</small>
          }
        </div>

        <div>
          <label for="patient-birthDate" class="form-label">
            {{ 'medical.patient.form.birthDate' | transloco }}
            <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input
            id="patient-birthDate"
            type="date"
            formControlName="birthDate"
            aria-required="true"
            class="form-input"
          />
          @if (form.controls.birthDate.touched && form.controls.birthDate.errors?.['required']) {
            <small class="error" role="alert">{{
              'medical.patient.form.birthDateRequired' | transloco
            }}</small>
          }
        </div>

        <div>
          <label for="patient-notes" class="form-label">{{
            'medical.patient.form.notes' | transloco
          }}</label>
          <textarea
            id="patient-notes"
            formControlName="notes"
            rows="3"
            class="form-input"
          ></textarea>
        </div>
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">
          {{ 'common.cancel' | transloco }}
        </button>
        <button type="submit" [disabled]="isInvalid()" class="btn-submit bg-ib-purple">
          {{
            (initial() ? 'medical.patient.form.save' : 'medical.patient.form.create') | transloco
          }}
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

  protected readonly isInvalid = formInvalid(this.form);

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
