import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { form, FormField, min, required, submit } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import { Medication, MedicationType } from '../../domain/models/medication.model';
import { Patient } from '../../domain/models/patient.model';
import { Prescription } from '../../domain/models/prescription.model';

type MedicationFormModel = {
  patientId: string;
  prescriptionId: string;
  name: string;
  type: MedicationType;
  dosage: string;
  quantity: number;
  dailyRate: number;
  startDate: string;
  alertDaysBefore: number;
};

function emptyMedicationModel(): MedicationFormModel {
  return {
    patientId: '',
    prescriptionId: '',
    name: '',
    type: 'comprime',
    dosage: '',
    quantity: 0,
    dailyRate: 1,
    startDate: new Date().toISOString().slice(0, 10),
    alertDaysBefore: 7,
  };
}

const DAY_LABELS = [
  { value: 0, label: 'Dim' },
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mer' },
  { value: 4, label: 'Jeu' },
  { value: 5, label: 'Ven' },
  { value: 6, label: 'Sam' },
];

const MEDICATION_TYPES: MedicationType[] = [
  'comprime',
  'gelule',
  'sirop',
  'patch',
  'injection',
  'gouttes',
  'creme',
  'autre',
];

@Component({
  selector: 'app-medication-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <form (submit)="submitForm($event)">
      <fieldset class="space-y-3">
        <legend class="sr-only">
          {{
            (initial()
              ? 'medical.medication.form.legendEdit'
              : 'medical.medication.form.legendCreate'
            ) | transloco
          }}
        </legend>

        <div>
          <label for="med-patient" class="form-label">
            {{ 'medical.medication.form.patient' | transloco }}
            <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <select
            id="med-patient"
            [formField]="medicationForm.patientId"
            aria-required="true"
            class="form-select"
          >
            <option value="">{{ 'medical.medication.form.patientPlaceholder' | transloco }}</option>
            @for (p of patients(); track p.id) {
              <option [value]="p.id">{{ p.firstName }} {{ p.lastName }}</option>
            }
          </select>
          @if (medicationForm.patientId().touched() && medicationForm.patientId().invalid()) {
            @for (err of medicationForm.patientId().errors(); track err.message) {
              <small class="error" role="alert">{{ err.message | transloco }}</small>
            }
          }
        </div>

        <div>
          <label for="med-prescription" class="form-label">{{
            'medical.medication.form.prescription' | transloco
          }}</label>
          <select
            id="med-prescription"
            [formField]="medicationForm.prescriptionId"
            class="form-select"
          >
            <option value="">
              {{ 'medical.medication.form.prescriptionPlaceholder' | transloco }}
            </option>
            @for (p of prescriptions(); track p.id) {
              <option [value]="p.id">
                {{ p.issuedDate }} —
                {{ p.notes ?? ('medical.medication.form.prescriptionFallbackNoNotes' | transloco) }}
              </option>
            }
          </select>
        </div>

        <div>
          <label for="med-name" class="form-label">
            {{ 'medical.medication.form.name' | transloco }}
            <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input
            id="med-name"
            type="text"
            [formField]="medicationForm.name"
            aria-required="true"
            class="form-input"
          />
          @if (medicationForm.name().touched() && medicationForm.name().invalid()) {
            @for (err of medicationForm.name().errors(); track err.message) {
              <small class="error" role="alert">{{ err.message | transloco }}</small>
            }
          }
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="med-type" class="form-label">
              {{ 'medical.medication.form.type' | transloco }}
              <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <select
              id="med-type"
              [formField]="medicationForm.type"
              aria-required="true"
              class="form-select"
            >
              @for (t of medicationTypes; track t) {
                <option [value]="t">{{ 'medical.medication.types.' + t | transloco }}</option>
              }
            </select>
          </div>
          <div>
            <label for="med-dosage" class="form-label">
              {{ 'medical.medication.form.dosage' | transloco }}
              <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <input
              id="med-dosage"
              type="text"
              [formField]="medicationForm.dosage"
              [placeholder]="'medical.medication.form.dosagePlaceholder' | transloco"
              aria-required="true"
              class="form-input"
            />
            @if (medicationForm.dosage().touched() && medicationForm.dosage().invalid()) {
              @for (err of medicationForm.dosage().errors(); track err.message) {
                <small class="error" role="alert">{{ err.message | transloco }}</small>
              }
            }
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="med-quantity" class="form-label">
              {{ 'medical.medication.form.quantity' | transloco }}
              <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <input
              id="med-quantity"
              type="number"
              [formField]="medicationForm.quantity"
              aria-required="true"
              class="form-input mono"
            />
            @if (medicationForm.quantity().touched() && medicationForm.quantity().invalid()) {
              @for (err of medicationForm.quantity().errors(); track err.message) {
                <small class="error" role="alert">{{ err.message | transloco }}</small>
              }
            }
          </div>
          <div>
            <label for="med-daily-rate" class="form-label">
              {{ 'medical.medication.form.dailyRate' | transloco }}
              <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <input
              id="med-daily-rate"
              type="number"
              [formField]="medicationForm.dailyRate"
              step="0.1"
              aria-required="true"
              class="form-input mono"
            />
            @if (medicationForm.dailyRate().touched() && medicationForm.dailyRate().invalid()) {
              @for (err of medicationForm.dailyRate().errors(); track err.message) {
                <small class="error" role="alert">{{ err.message | transloco }}</small>
              }
            }
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="med-start-date" class="form-label">
              {{ 'medical.medication.form.startDate' | transloco }}
              <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <input
              id="med-start-date"
              type="date"
              [formField]="medicationForm.startDate"
              aria-required="true"
              class="form-input"
            />
            @if (medicationForm.startDate().touched() && medicationForm.startDate().invalid()) {
              @for (err of medicationForm.startDate().errors(); track err.message) {
                <small class="error" role="alert">{{ err.message | transloco }}</small>
              }
            }
          </div>
          <div>
            <label for="med-alert" class="form-label">
              {{ 'medical.medication.form.alertDays' | transloco }}
              <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <input
              id="med-alert"
              type="number"
              [formField]="medicationForm.alertDaysBefore"
              aria-required="true"
              class="form-input mono"
            />
            @if (
              medicationForm.alertDaysBefore().touched() &&
              medicationForm.alertDaysBefore().invalid()
            ) {
              @for (err of medicationForm.alertDaysBefore().errors(); track err.message) {
                <small class="error" role="alert">{{ err.message | transloco }}</small>
              }
            }
          </div>
        </div>

        <!-- Jours de non-prise -->
        <fieldset>
          <legend class="form-label">{{ 'medical.medication.form.skipLegend' | transloco }}</legend>
          <p class="text-xs text-text-muted mb-2">
            {{ 'medical.medication.form.skipHint' | transloco }}
          </p>
          <div class="flex gap-1">
            @for (day of days; track day.value) {
              <button
                type="button"
                class="flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-purple"
                [class.bg-ib-purple]="isDaySkipped(day.value)"
                [class.text-canvas]="isDaySkipped(day.value)"
                [class.border-ib-purple]="isDaySkipped(day.value)"
                [class.bg-transparent]="!isDaySkipped(day.value)"
                [class.text-text-muted]="!isDaySkipped(day.value)"
                [class.border-border]="!isDaySkipped(day.value)"
                [class.hover:border-ib-purple-30]="!isDaySkipped(day.value)"
                (click)="toggleDay(day.value)"
              >
                {{ day.label }}
              </button>
            }
          </div>
        </fieldset>
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">
          {{ 'common.cancel' | transloco }}
        </button>
        <button
          type="submit"
          [disabled]="medicationForm().invalid()"
          class="btn-submit bg-ib-purple"
        >
          {{
            (initial() ? 'medical.medication.form.save' : 'medical.medication.form.create')
              | transloco
          }}
        </button>
      </footer>
    </form>
  `,
})
export class MedicationForm {
  readonly initial = input<Medication | null>(null);
  readonly patients = input<Patient[]>([]);
  readonly prescriptions = input<Prescription[]>([]);
  readonly submitted = output<Omit<Medication, 'id'>>();
  readonly cancelled = output<void>();

  protected readonly days = DAY_LABELS;
  protected readonly medicationTypes = MEDICATION_TYPES;

  // État dérivé modifiable : se réinitialise quand `initial` change, éditable par le form.
  protected readonly model = linkedSignal<MedicationFormModel>(() => {
    const data = this.initial();
    return data
      ? {
          patientId: data.patientId,
          prescriptionId: data.prescriptionId ?? '',
          name: data.name,
          type: data.type,
          dosage: data.dosage,
          quantity: data.quantity,
          dailyRate: data.dailyRate,
          startDate: data.startDate,
          alertDaysBefore: data.alertDaysBefore,
        }
      : emptyMedicationModel();
  });

  // Jours de non-prise : hors FormControl, signal éditable réinitialisé sur `initial`.
  protected readonly skipDays = linkedSignal<number[]>(() => {
    const data = this.initial();
    return data ? [...data.skipDays] : [];
  });

  protected readonly medicationForm = form(this.model, (path) => {
    required(path.patientId, { message: 'medical.medication.form.patientRequired' });
    required(path.name, { message: 'medical.medication.form.nameRequired' });
    required(path.type);
    required(path.dosage, { message: 'medical.medication.form.dosageRequired' });
    required(path.quantity, { message: 'medical.medication.form.quantityRequired' });
    min(path.quantity, 0, { message: 'medical.medication.form.quantityMin' });
    required(path.dailyRate, { message: 'medical.medication.form.dailyRateRequired' });
    min(path.dailyRate, 0.1, { message: 'medical.medication.form.dailyRateMin' });
    required(path.startDate, { message: 'medical.medication.form.startDateRequired' });
    required(path.alertDaysBefore, { message: 'medical.medication.form.alertDaysRequired' });
    min(path.alertDaysBefore, 1, { message: 'medical.medication.form.alertDaysMin' });
  });

  protected isDaySkipped(day: number): boolean {
    return this.skipDays().includes(day);
  }

  protected toggleDay(day: number) {
    const current = this.skipDays();
    if (current.includes(day)) {
      this.skipDays.set(current.filter((d) => d !== day));
    } else {
      this.skipDays.set([...current, day]);
    }
  }

  protected async submitForm(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.medicationForm, async () => {
      const v = this.model();
      this.submitted.emit({
        patientId: v.patientId,
        prescriptionId: v.prescriptionId || null,
        name: v.name,
        type: v.type,
        dosage: v.dosage,
        quantity: v.quantity,
        dailyRate: v.dailyRate,
        startDate: v.startDate,
        alertDaysBefore: v.alertDaysBefore,
        skipDays: this.skipDays(),
      });
      return [];
    });
  }
}
