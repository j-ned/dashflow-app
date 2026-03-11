import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
import { Reminder, ReminderTarget, ReminderType } from '../../domain/models/reminder.model';
import { Medication } from '../../domain/models/medication.model';
import { Appointment } from '../../domain/models/appointment.model';

type ReminderFormShape = {
  type: FormControl<ReminderType>;
  target: FormControl<ReminderTarget>;
  medicationId: FormControl<string>;
  appointmentId: FormControl<string>;
  recipientEmail: FormControl<string>;
};

@Component({
  selector: 'app-reminder-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submitForm()">
      <fieldset class="space-y-3">
        <legend class="sr-only">Nouvelle alerte</legend>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="rem-type" class="form-label">
              Type <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <select id="rem-type" formControlName="type" aria-required="true"
                    class="form-select">
              <option value="email">Email</option>
              <option value="ical">iCal</option>
            </select>
          </div>
          <div>
            <label for="rem-target" class="form-label">
              Cible <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <select id="rem-target" formControlName="target" aria-required="true"
                    class="form-select"
                    (change)="onTargetChange()">
              <option value="medication">Medicament</option>
              <option value="appointment">Rendez-vous</option>
            </select>
          </div>
        </div>

        @if (selectedTarget() === 'medication') {
          <div>
            <label for="rem-medication" class="form-label">Medicament</label>
            <select id="rem-medication" formControlName="medicationId"
                    class="form-select">
              <option value="">-- Selectionner --</option>
              @for (m of medications(); track m.id) {
                <option [value]="m.id">{{ m.name }} ({{ m.dosage }})</option>
              }
            </select>
          </div>
        }

        @if (selectedTarget() === 'appointment') {
          <div>
            <label for="rem-appointment" class="form-label">Rendez-vous</label>
            <select id="rem-appointment" formControlName="appointmentId"
                    class="form-select">
              <option value="">-- Selectionner --</option>
              @for (a of appointments(); track a.id) {
                <option [value]="a.id">{{ a.date }} {{ a.time }}</option>
              }
            </select>
          </div>
        }

        <div>
          <label for="rem-email" class="form-label">
            Email destinataire <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input id="rem-email" type="email" formControlName="recipientEmail" aria-required="true"
                 class="form-input" />
          @if (form.controls.recipientEmail.touched) {
            @if (form.controls.recipientEmail.errors?.['required']) {
              <small class="error" role="alert">L'email est obligatoire.</small>
            } @else if (form.controls.recipientEmail.errors?.['email']) {
              <small class="error" role="alert">Format email invalide.</small>
            }
          }
        </div>
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">Annuler</button>
        <button type="submit" [disabled]="isInvalid()"
                class="btn-submit" style="background-color: var(--color-ib-purple)">
          Creer
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

  protected readonly selectedTarget = signal<ReminderTarget>('medication');

  protected readonly form = new FormGroup<ReminderFormShape>({
    type: new FormControl<ReminderType>('email', { nonNullable: true, validators: [Validators.required] }),
    target: new FormControl<ReminderTarget>('medication', { nonNullable: true, validators: [Validators.required] }),
    medicationId: new FormControl('', { nonNullable: true }),
    appointmentId: new FormControl('', { nonNullable: true }),
    recipientEmail: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
  });

  protected readonly isInvalid = toSignal(
    this.form.statusChanges.pipe(map(() => this.form.invalid)),
    { initialValue: this.form.invalid },
  );

  protected onTargetChange() {
    this.selectedTarget.set(this.form.controls.target.value);
    this.form.controls.medicationId.setValue('');
    this.form.controls.appointmentId.setValue('');
  }

  protected submitForm() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.submitted.emit({
      type: v.type,
      target: v.target,
      medicationId: v.target === 'medication' && v.medicationId ? v.medicationId : null,
      appointmentId: v.target === 'appointment' && v.appointmentId ? v.appointmentId : null,
      recipientEmail: v.recipientEmail,
      enabled: true,
    });
    this.form.reset();
    this.selectedTarget.set('medication');
  }
}
