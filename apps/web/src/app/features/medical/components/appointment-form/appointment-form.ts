import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import { Appointment, AppointmentStatus } from '../../domain/models/appointment.model';
import { Patient } from '../../domain/models/patient.model';
import { Practitioner } from '../../domain/models/practitioner.model';

type AppointmentFormModel = {
  patientId: string;
  practitionerId: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  reason: string;
  outcome: string;
};

const EMPTY_MODEL: AppointmentFormModel = {
  patientId: '',
  practitionerId: '',
  date: '',
  time: '',
  status: 'scheduled',
  reason: '',
  outcome: '',
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
  imports: [FormField, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <form (submit)="submitForm($event)">
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
            [formField]="appointmentForm.patientId"
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
          @if (appointmentForm.patientId().touched() && appointmentForm.patientId().invalid()) {
            @for (err of appointmentForm.patientId().errors(); track err.message) {
              <small class="error" role="alert">{{ err.message | transloco }}</small>
            }
          }
        </div>

        <div>
          <label for="appt-practitionerId" class="form-label">
            {{ 'medical.appointment.form.practitioner' | transloco }}
            <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <select
            id="appt-practitionerId"
            [formField]="appointmentForm.practitionerId"
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
            appointmentForm.practitionerId().touched() &&
            appointmentForm.practitionerId().invalid()
          ) {
            @for (err of appointmentForm.practitionerId().errors(); track err.message) {
              <small class="error" role="alert">{{ err.message | transloco }}</small>
            }
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
              [formField]="appointmentForm.date"
              aria-required="true"
              class="form-input"
            />
            @if (appointmentForm.date().touched() && appointmentForm.date().invalid()) {
              @for (err of appointmentForm.date().errors(); track err.message) {
                <small class="error" role="alert">{{ err.message | transloco }}</small>
              }
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
              [formField]="appointmentForm.time"
              aria-required="true"
              class="form-input"
            />
            @if (appointmentForm.time().touched() && appointmentForm.time().invalid()) {
              @for (err of appointmentForm.time().errors(); track err.message) {
                <small class="error" role="alert">{{ err.message | transloco }}</small>
              }
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
            [formField]="appointmentForm.status"
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
            [formField]="appointmentForm.reason"
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
            [formField]="appointmentForm.outcome"
            rows="2"
            class="form-input"
          ></textarea>
        </div>
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">
          {{ 'common.cancel' | transloco }}
        </button>
        <button
          type="submit"
          [disabled]="appointmentForm().invalid()"
          class="btn-submit bg-ib-purple"
        >
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

  // État dérivé modifiable : se réinitialise quand `initial` change, éditable par le form.
  protected readonly model = linkedSignal<AppointmentFormModel>(() => {
    const data = this.initial();
    return data
      ? {
          patientId: data.patientId,
          practitionerId: data.practitionerId,
          date: data.date,
          time: data.time,
          status: data.status,
          reason: data.reason ?? '',
          outcome: data.outcome ?? '',
        }
      : { ...EMPTY_MODEL };
  });

  protected readonly appointmentForm = form(this.model, (path) => {
    required(path.patientId, { message: 'medical.appointment.form.patientRequired' });
    required(path.practitionerId, { message: 'medical.appointment.form.practitionerRequired' });
    required(path.date, { message: 'medical.appointment.form.dateRequired' });
    required(path.time, { message: 'medical.appointment.form.timeRequired' });
    required(path.status, { message: 'medical.appointment.form.statusRequired' });
  });

  protected async submitForm(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.appointmentForm, async () => {
      const v = this.model();
      this.submitted.emit({
        patientId: v.patientId,
        practitionerId: v.practitionerId,
        date: v.date,
        time: v.time,
        status: v.status,
        reason: v.reason || null,
        outcome: v.outcome || null,
      });
      return [];
    });
  }
}
