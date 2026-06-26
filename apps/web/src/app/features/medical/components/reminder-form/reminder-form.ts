import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { email, form, FormField, required, submit } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import { Reminder, ReminderTarget, ReminderType } from '../../domain/models/reminder.model';
import { Medication } from '../../domain/models/medication.model';
import { Appointment } from '../../domain/models/appointment.model';

type ReminderModel = {
  type: ReminderType;
  target: ReminderTarget;
  medicationId: string;
  appointmentId: string;
  recipientEmail: string;
};

const EMPTY_MODEL: ReminderModel = {
  type: 'email',
  target: 'medication',
  medicationId: '',
  appointmentId: '',
  recipientEmail: '',
};

@Component({
  selector: 'app-reminder-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <form (submit)="submitForm($event)">
      <fieldset class="space-y-3">
        <legend class="sr-only">{{ 'medical.reminder.form.legend' | transloco }}</legend>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="rem-type" class="form-label">
              {{ 'medical.reminder.form.type' | transloco }}
              <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <select id="rem-type" [formField]="reminderForm.type" aria-required="true" class="form-select">
              <option value="email">{{ 'medical.reminder.typeEmail' | transloco }}</option>
              <option value="ical">{{ 'medical.reminder.typeIcal' | transloco }}</option>
            </select>
          </div>
          <div>
            <label for="rem-target" class="form-label">
              {{ 'medical.reminder.form.target' | transloco }}
              <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <select
              id="rem-target"
              [formField]="reminderForm.target"
              aria-required="true"
              class="form-select"
              (change)="onTargetChange()"
            >
              <option value="medication">
                {{ 'medical.reminder.targetMedication' | transloco }}
              </option>
              <option value="appointment">
                {{ 'medical.reminder.targetAppointment' | transloco }}
              </option>
            </select>
          </div>
        </div>

        @if (selectedTarget() === 'medication') {
          <div>
            <label for="rem-medication" class="form-label">
              {{ 'medical.reminder.form.medication' | transloco }}
              <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <select
              id="rem-medication"
              [formField]="reminderForm.medicationId"
              aria-required="true"
              class="form-select"
            >
              <option value="">{{ 'medical.reminder.form.selectPlaceholder' | transloco }}</option>
              @for (m of medications(); track m.id) {
                <option [value]="m.id">{{ m.name }} ({{ m.dosage }})</option>
              }
            </select>
          </div>
        }

        @if (selectedTarget() === 'appointment') {
          <div>
            <label for="rem-appointment" class="form-label">
              {{ 'medical.reminder.form.appointment' | transloco }}
              <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <select
              id="rem-appointment"
              [formField]="reminderForm.appointmentId"
              aria-required="true"
              class="form-select"
            >
              <option value="">{{ 'medical.reminder.form.selectPlaceholder' | transloco }}</option>
              @for (a of appointments(); track a.id) {
                <option [value]="a.id">{{ a.date }} {{ a.time }}</option>
              }
            </select>
          </div>
        }

        <div>
          <label for="rem-email" class="form-label">
            {{ 'medical.reminder.form.recipientEmail' | transloco }}
            <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input
            id="rem-email"
            type="email"
            [formField]="reminderForm.recipientEmail"
            aria-required="true"
            class="form-input"
          />
          @if (reminderForm.recipientEmail().touched() && reminderForm.recipientEmail().invalid()) {
            @for (err of reminderForm.recipientEmail().errors(); track err.message) {
              <small class="error" role="alert">{{ err.message | transloco }}</small>
            }
          }
        </div>
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">
          {{ 'common.cancel' | transloco }}
        </button>
        <button type="submit" [disabled]="reminderForm().invalid()" class="btn-submit bg-ib-purple">
          {{ 'medical.reminder.form.submit' | transloco }}
        </button>
      </footer>
    </form>
  `,
})
export class ReminderForm {
  readonly medications = input<Medication[]>([]);
  readonly appointments = input<Appointment[]>([]);
  readonly submitted = output<Omit<Reminder, 'id'>>();
  readonly cancelled = output<void>();

  protected readonly model = signal<ReminderModel>({ ...EMPTY_MODEL });

  protected readonly selectedTarget = computed(() => this.model().target);

  protected readonly reminderForm = form(this.model, (path) => {
    required(path.type, { message: 'medical.reminder.form.type' });
    required(path.target, { message: 'medical.reminder.form.target' });
    required(path.medicationId, {
      when: ({ valueOf }) => valueOf(path.target) === 'medication',
      message: 'medical.reminder.form.medication',
    });
    required(path.appointmentId, {
      when: ({ valueOf }) => valueOf(path.target) === 'appointment',
      message: 'medical.reminder.form.appointment',
    });
    required(path.recipientEmail, { message: 'medical.reminder.form.emailRequired' });
    email(path.recipientEmail, { message: 'medical.reminder.form.emailInvalid' });
  });

  protected onTargetChange(): void {
    this.model.update((m) => ({ ...m, medicationId: '', appointmentId: '' }));
  }

  protected async submitForm(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.reminderForm, async () => {
      const v = this.model();
      this.submitted.emit({
        type: v.type,
        target: v.target,
        medicationId: v.target === 'medication' && v.medicationId ? v.medicationId : null,
        appointmentId: v.target === 'appointment' && v.appointmentId ? v.appointmentId : null,
        recipientEmail: v.recipientEmail,
        enabled: true,
      });
      this.model.set({ ...EMPTY_MODEL });
      return [];
    });
  }
}
