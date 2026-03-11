import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
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

@Component({
  selector: 'app-medication-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submitForm()">
      <fieldset class="space-y-3">
        <legend class="sr-only">{{ initial() ? 'Modifier medicament' : 'Nouveau medicament' }}</legend>

        <div>
          <label for="med-patient" class="form-label">
            Patient <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <select id="med-patient" formControlName="patientId" aria-required="true"
                  class="form-select">
            <option value="">-- Selectionner un patient --</option>
            @for (p of patients(); track p.id) {
              <option [value]="p.id">{{ p.firstName }} {{ p.lastName }}</option>
            }
          </select>
          @if (form.controls.patientId.touched && form.controls.patientId.errors?.['required']) {
            <small class="error" role="alert">Le patient est obligatoire.</small>
          }
        </div>

        <div>
          <label for="med-prescription" class="form-label">Ordonnance liee</label>
          <select id="med-prescription" formControlName="prescriptionId"
                  class="form-select">
            <option value="">-- Aucune --</option>
            @for (p of prescriptions(); track p.id) {
              <option [value]="p.id">{{ p.issuedDate }} — {{ p.notes ?? 'Sans notes' }}</option>
            }
          </select>
        </div>

        <div>
          <label for="med-name" class="form-label">
            Nom <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input id="med-name" type="text" formControlName="name" aria-required="true"
                 class="form-input" />
          @if (form.controls.name.touched && form.controls.name.errors?.['required']) {
            <small class="error" role="alert">Le nom est obligatoire.</small>
          }
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="med-type" class="form-label">
              Type <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <select id="med-type" formControlName="type" aria-required="true"
                    class="form-select">
              <option value="comprime">Comprime</option>
              <option value="gelule">Gelule</option>
              <option value="sirop">Sirop</option>
              <option value="patch">Patch</option>
              <option value="injection">Injection</option>
              <option value="gouttes">Gouttes</option>
              <option value="creme">Creme</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div>
            <label for="med-dosage" class="form-label">
              Dosage <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <input id="med-dosage" type="text" formControlName="dosage" placeholder="ex: 20mg" aria-required="true"
                   class="form-input" />
            @if (form.controls.dosage.touched && form.controls.dosage.errors?.['required']) {
              <small class="error" role="alert">Le dosage est obligatoire.</small>
            }
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="med-quantity" class="form-label">
              Quantite <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <input id="med-quantity" type="number" formControlName="quantity" min="0" aria-required="true"
                   class="form-input mono" />
            @if (form.controls.quantity.touched) {
              @if (form.controls.quantity.errors?.['required']) {
                <small class="error" role="alert">La quantite est obligatoire.</small>
              } @else if (form.controls.quantity.errors?.['min']) {
                <small class="error" role="alert">La quantite ne peut pas etre negative.</small>
              }
            }
          </div>
          <div>
            <label for="med-daily-rate" class="form-label">
              Consommation/jour <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <input id="med-daily-rate" type="number" formControlName="dailyRate" min="0.1" step="0.1" aria-required="true"
                   class="form-input mono" />
            @if (form.controls.dailyRate.touched) {
              @if (form.controls.dailyRate.errors?.['required']) {
                <small class="error" role="alert">La consommation journaliere est obligatoire.</small>
              } @else if (form.controls.dailyRate.errors?.['min']) {
                <small class="error" role="alert">La consommation doit etre d'au minimum 0.1.</small>
              }
            }
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="med-start-date" class="form-label">
              Date de debut <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <input id="med-start-date" type="date" formControlName="startDate" aria-required="true"
                   class="form-input" />
            @if (form.controls.startDate.touched && form.controls.startDate.errors?.['required']) {
              <small class="error" role="alert">La date de debut est obligatoire.</small>
            }
          </div>
          <div>
            <label for="med-alert" class="form-label">
              Alerte (jours avant) <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <input id="med-alert" type="number" formControlName="alertDaysBefore" min="1" aria-required="true"
                   class="form-input mono" />
            @if (form.controls.alertDaysBefore.touched) {
              @if (form.controls.alertDaysBefore.errors?.['required']) {
                <small class="error" role="alert">Le seuil d'alerte est obligatoire.</small>
              } @else if (form.controls.alertDaysBefore.errors?.['min']) {
                <small class="error" role="alert">Le seuil doit etre d'au minimum 1 jour.</small>
              }
            }
          </div>
        </div>

        <!-- Jours de non-prise -->
        <fieldset>
          <legend class="form-label">Jours sans prise</legend>
          <p class="text-xs text-text-muted mb-2">Cochez les jours ou le medicament n'est PAS pris</p>
          <div class="flex gap-1">
            @for (day of days; track day.value) {
              <button type="button"
                      class="flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-purple"
                      [class.bg-ib-purple]="isDaySkipped(day.value)"
                      [class.text-white]="isDaySkipped(day.value)"
                      [class.border-ib-purple]="isDaySkipped(day.value)"
                      [class.bg-transparent]="!isDaySkipped(day.value)"
                      [class.text-text-muted]="!isDaySkipped(day.value)"
                      [class.border-border]="!isDaySkipped(day.value)"
                      [class.hover:border-ib-purple-30]="!isDaySkipped(day.value)"
                      (click)="toggleDay(day.value)">
                {{ day.label }}
              </button>
            }
          </div>
        </fieldset>
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">Annuler</button>
        <button type="submit" [disabled]="isInvalid()"
                class="btn-submit" style="background-color: var(--color-ib-purple)">
          {{ initial() ? 'Enregistrer' : 'Creer' }}
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
  protected readonly skipDays = signal<number[]>([]);

  protected readonly form = new FormGroup<MedicationFormShape>({
    patientId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    prescriptionId: new FormControl('', { nonNullable: true }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    type: new FormControl<MedicationType>('comprime', { nonNullable: true, validators: [Validators.required] }),
    dosage: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    quantity: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    dailyRate: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(0.1)] }),
    startDate: new FormControl(new Date().toISOString().slice(0, 10), { nonNullable: true, validators: [Validators.required] }),
    alertDaysBefore: new FormControl(7, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
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
      this.skipDays.set(current.filter(d => d !== day));
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
