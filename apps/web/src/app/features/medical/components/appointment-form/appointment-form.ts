import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { formInvalid } from '@shared/forms/form-invalid';
import { Appointment, AppointmentStatus } from '../../domain/models/appointment.model';
import { Patient } from '../../domain/models/patient.model';
import { Practitioner } from '../../domain/models/practitioner.model';

type AppointmentFormShape = {
  patientId: FormControl<string>;
  practitionerId: FormControl<string>;
  date: FormControl<string>;
  time: FormControl<string>;
  status: FormControl<AppointmentStatus>;
  reason: FormControl<string>;
  outcome: FormControl<string>;
};

const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'scheduled',
  'completed',
  'cancelled',
  'no_show',
];

@Component({
  selector: 'app-appointment-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submitForm()">
      <fieldset class="space-y-3">
        <legend class="sr-only">
          {{
            (initial()
              ? 'medical.appointment.form.legendEdit'
              : 'medical.appointment.form.legendCreate'
            ) | transloco
          }}
        </legend>

        <div>
          <label for="appt-patientId" class="form-label">
            {{ 'medical.appointment.form.patient' | transloco }}
            <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <select
            id="appt-patientId"
            formControlName="patientId"
            aria-required="true"
            class="form-select"
          >
            <option value="">
              {{ 'medical.appointment.form.patientPlaceholder' | transloco }}
            </option>
            @for (p of patients(); track p.id) {
              <option [value]="p.id">{{ p.firstName }} {{ p.lastName }}</option>
            }
          </select>
          @if (form.controls.patientId.touched && form.controls.patientId.errors?.['required']) {
            <small class="error" role="alert">{{
              'medical.appointment.form.patientRequired' | transloco
            }}</small>
          }
        </div>

        <div>
          <label for="appt-practitionerId" class="form-label">
            {{ 'medical.appointment.form.practitioner' | transloco }}
            <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <select
            id="appt-practitionerId"
            formControlName="practitionerId"
            aria-required="true"
            class="form-select"
          >
            <option value="">
              {{ 'medical.appointment.form.practitionerPlaceholder' | transloco }}
            </option>
            @for (pr of practitioners(); track pr.id) {
              <option [value]="pr.id">
                {{ pr.name }} ({{ 'medical.practitioner.types.' + pr.type | transloco }})
              </option>
            }
          </select>
          @if (
            form.controls.practitionerId.touched &&
            form.controls.practitionerId.errors?.['required']
          ) {
            <small class="error" role="alert">{{
              'medical.appointment.form.practitionerRequired' | transloco
            }}</small>
          }
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="appt-date" class="form-label">
              {{ 'medical.appointment.form.date' | transloco }}
              <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <input
              id="appt-date"
              type="date"
              formControlName="date"
              aria-required="true"
              class="form-input"
            />
            @if (form.controls.date.touched && form.controls.date.errors?.['required']) {
              <small class="error" role="alert">{{
                'medical.appointment.form.dateRequired' | transloco
              }}</small>
            }
          </div>

          <div>
            <label for="appt-time" class="form-label">
              {{ 'medical.appointment.form.time' | transloco }}
              <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <input
              id="appt-time"
              type="time"
              formControlName="time"
              aria-required="true"
              class="form-input"
            />
            @if (form.controls.time.touched && form.controls.time.errors?.['required']) {
              <small class="error" role="alert">{{
                'medical.appointment.form.timeRequired' | transloco
              }}</small>
            }
          </div>
        </div>

        <div>
          <label for="appt-status" class="form-label">
            {{ 'medical.appointment.form.status' | transloco }}
            <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <select
            id="appt-status"
            formControlName="status"
            aria-required="true"
            class="form-select"
          >
            @for (entry of statuses; track entry) {
              <option [value]="entry">
                {{ 'medical.appointment.statuses.' + entry | transloco }}
              </option>
            }
          </select>
        </div>

        <div>
          <label for="appt-reason" class="form-label">{{
            'medical.appointment.form.reason' | transloco
          }}</label>
          <textarea
            id="appt-reason"
            formControlName="reason"
            rows="2"
            class="form-input"
          ></textarea>
        </div>

        <div>
          <label for="appt-outcome" class="form-label">{{
            'medical.appointment.form.outcome' | transloco
          }}</label>
          <textarea
            id="appt-outcome"
            formControlName="outcome"
            rows="2"
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
            (initial() ? 'medical.appointment.form.save' : 'medical.appointment.form.create')
              | transloco
          }}
        </button>
      </footer>
    </form>
  `,
})
export class AppointmentForm {
  readonly initial = input<Appointment | null>(null);
  readonly patients = input<Patient[]>([]);
  readonly practitioners = input<Practitioner[]>([]);
  readonly submitted = output<Omit<Appointment, 'id'>>();
  readonly cancelled = output<void>();

  protected readonly statuses = APPOINTMENT_STATUSES;

  protected readonly form = new FormGroup<AppointmentFormShape>({
    patientId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    practitionerId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    date: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    time: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    status: new FormControl<AppointmentStatus>('scheduled', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    reason: new FormControl('', { nonNullable: true }),
    outcome: new FormControl('', { nonNullable: true }),
  });

  protected readonly isInvalid = formInvalid(this.form);

  constructor() {
    effect(() => {
      const data = this.initial();
      if (data) {
        this.form.patchValue({
          patientId: data.patientId,
          practitionerId: data.practitionerId,
          date: data.date,
          time: data.time,
          status: data.status,
          reason: data.reason ?? '',
          outcome: data.outcome ?? '',
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
      patientId: v.patientId,
      practitionerId: v.practitionerId,
      date: v.date,
      time: v.time,
      status: v.status,
      reason: v.reason || null,
      outcome: v.outcome || null,
    });
  }
}
