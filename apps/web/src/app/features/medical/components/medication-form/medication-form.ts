import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { Medication, MedicationType } from '../../domain/models/medication.model';
import { Patient } from '../../domain/models/patient.model';
import { Prescription } from '../../domain/models/prescription.model';

type MedicationFormShape = {
  patientId: FormControl<string>;
  prescriptionId: FormControl<string>;
  name: FormControl<string>;
  type: FormControl<MedicationType>;
  dosage: FormControl<string>;
  quantity: FormControl<number>;
  dailyRate: FormControl<number>;
  startDate: FormControl<string>;
  alertDaysBefore: FormControl<number>;
};

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
  imports: [ReactiveFormsModule, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submitForm()">
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
            formControlName="patientId"
            aria-required="true"
            class="form-select"
          >
            <option value="">{{ 'medical.medication.form.patientPlaceholder' | transloco }}</option>
            @for (p of patients(); track p.id) {
              <option [value]="p.id">{{ p.firstName }} {{ p.lastName }}</option>
            }
          </select>
          @if (form.controls.patientId.touched && form.controls.patientId.errors?.['required']) {
            <small class="error" role="alert">{{
              'medical.medication.form.patientRequired' | transloco
            }}</small>
          }
        </div>

        <div>
          <label for="med-prescription" class="form-label">{{
            'medical.medication.form.prescription' | transloco
          }}</label>
          <select id="med-prescription" formControlName="prescriptionId" class="form-select">
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
            formControlName="name"
            aria-required="true"
            class="form-input"
          />
          @if (form.controls.name.touched && form.controls.name.errors?.['required']) {
            <small class="error" role="alert">{{
              'medical.medication.form.nameRequired' | transloco
            }}</small>
          }
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="med-type" class="form-label">
              {{ 'medical.medication.form.type' | transloco }}
              <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <select id="med-type" formControlName="type" aria-required="true" class="form-select">
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
              formControlName="dosage"
              [placeholder]="'medical.medication.form.dosagePlaceholder' | transloco"
              aria-required="true"
              class="form-input"
            />
            @if (form.controls.dosage.touched && form.controls.dosage.errors?.['required']) {
              <small class="error" role="alert">{{
                'medical.medication.form.dosageRequired' | transloco
              }}</small>
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
              formControlName="quantity"
              min="0"
              aria-required="true"
              class="form-input mono"
            />
            @if (form.controls.quantity.touched) {
              @if (form.controls.quantity.errors?.['required']) {
                <small class="error" role="alert">{{
                  'medical.medication.form.quantityRequired' | transloco
                }}</small>
              } @else if (form.controls.quantity.errors?.['min']) {
                <small class="error" role="alert">{{
                  'medical.medication.form.quantityMin' | transloco
                }}</small>
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
              formControlName="dailyRate"
              min="0.1"
              step="0.1"
              aria-required="true"
              class="form-input mono"
            />
            @if (form.controls.dailyRate.touched) {
              @if (form.controls.dailyRate.errors?.['required']) {
                <small class="error" role="alert">{{
                  'medical.medication.form.dailyRateRequired' | transloco
                }}</small>
              } @else if (form.controls.dailyRate.errors?.['min']) {
                <small class="error" role="alert">{{
                  'medical.medication.form.dailyRateMin' | transloco
                }}</small>
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
              formControlName="startDate"
              aria-required="true"
              class="form-input"
            />
            @if (form.controls.startDate.touched && form.controls.startDate.errors?.['required']) {
              <small class="error" role="alert">{{
                'medical.medication.form.startDateRequired' | transloco
              }}</small>
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
              formControlName="alertDaysBefore"
              min="1"
              aria-required="true"
              class="form-input mono"
            />
            @if (form.controls.alertDaysBefore.touched) {
              @if (form.controls.alertDaysBefore.errors?.['required']) {
                <small class="error" role="alert">{{
                  'medical.medication.form.alertDaysRequired' | transloco
                }}</small>
              } @else if (form.controls.alertDaysBefore.errors?.['min']) {
                <small class="error" role="alert">{{
                  'medical.medication.form.alertDaysMin' | transloco
                }}</small>
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
        <button type="submit" [disabled]="isInvalid()" class="btn-submit bg-ib-purple">
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
  protected readonly skipDays = signal<number[]>([]);

  protected readonly form = new FormGroup<MedicationFormShape>({
    patientId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    prescriptionId: new FormControl('', { nonNullable: true }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    type: new FormControl<MedicationType>('comprime', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    dosage: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    quantity: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    dailyRate: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0.1)],
    }),
    startDate: new FormControl(new Date().toISOString().slice(0, 10), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    alertDaysBefore: new FormControl(7, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
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
          patientId: data.patientId,
          prescriptionId: data.prescriptionId ?? '',
          name: data.name,
          type: data.type,
          dosage: data.dosage,
          quantity: data.quantity,
          dailyRate: data.dailyRate,
          startDate: data.startDate,
          alertDaysBefore: data.alertDaysBefore,
        });
        this.skipDays.set([...data.skipDays]);
      } else {
        this.form.reset();
        this.skipDays.set([]);
      }
    });
  }

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

  protected submitForm() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
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
  }
}
