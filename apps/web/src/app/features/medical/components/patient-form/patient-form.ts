import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import { Patient } from '../../domain/models/patient.model';

type PatientFormModel = {
  firstName: string;
  lastName: string;
  birthDate: string;
  notes: string;
};

const EMPTY_MODEL: PatientFormModel = { firstName: '', lastName: '', birthDate: '', notes: '' };

@Component({
  selector: 'app-patient-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <form (submit)="submitForm($event)">
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
            [formField]="patientForm.firstName"
            aria-required="true"
            class="form-input"
          />
          @if (patientForm.firstName().touched() && patientForm.firstName().invalid()) {
            @for (err of patientForm.firstName().errors(); track err.message) {
              <small class="error" role="alert">{{ err.message | transloco }}</small>
            }
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
            [formField]="patientForm.lastName"
            aria-required="true"
            class="form-input"
          />
          @if (patientForm.lastName().touched() && patientForm.lastName().invalid()) {
            @for (err of patientForm.lastName().errors(); track err.message) {
              <small class="error" role="alert">{{ err.message | transloco }}</small>
            }
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
            [formField]="patientForm.birthDate"
            aria-required="true"
            class="form-input"
          />
          @if (patientForm.birthDate().touched() && patientForm.birthDate().invalid()) {
            @for (err of patientForm.birthDate().errors(); track err.message) {
              <small class="error" role="alert">{{ err.message | transloco }}</small>
            }
          }
        </div>

        <div>
          <label for="patient-notes" class="form-label">{{
            'medical.patient.form.notes' | transloco
          }}</label>
          <textarea
            id="patient-notes"
            [formField]="patientForm.notes"
            rows="3"
            class="form-input"
          ></textarea>
        </div>
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">
          {{ 'common.cancel' | transloco }}
        </button>
        <button type="submit" [disabled]="patientForm().invalid()" class="btn-submit bg-ib-purple">
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

  // État dérivé modifiable : se réinitialise quand `initial` change, éditable par le form.
  protected readonly model = linkedSignal<PatientFormModel>(() => {
    const data = this.initial();
    return data
      ? {
          firstName: data.firstName,
          lastName: data.lastName,
          birthDate: data.birthDate,
          notes: data.notes ?? '',
        }
      : { ...EMPTY_MODEL };
  });

  protected readonly patientForm = form(this.model, (path) => {
    required(path.firstName, { message: 'medical.patient.form.firstNameRequired' });
    required(path.lastName, { message: 'medical.patient.form.lastNameRequired' });
    required(path.birthDate, { message: 'medical.patient.form.birthDateRequired' });
  });

  protected async submitForm(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.patientForm, async () => {
      const v = this.model();
      this.submitted.emit({
        firstName: v.firstName,
        lastName: v.lastName,
        birthDate: v.birthDate,
        notes: v.notes || null,
      });
      return [];
    });
  }
}
