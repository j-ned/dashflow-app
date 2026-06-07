import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { Prescription } from '../../domain/models/prescription.model';
import { Patient } from '../../domain/models/patient.model';
import { Appointment } from '../../domain/models/appointment.model';
import { Practitioner } from '../../domain/models/practitioner.model';

type PrescriptionFormShape = {
  patientId: FormControl<string>;
  practitionerId: FormControl<string>;
  appointmentId: FormControl<string>;
  issuedDate: FormControl<string>;
  validUntil: FormControl<string>;
  notes: FormControl<string>;
};

export type PrescriptionSubmitData = {
  data: Omit<Prescription, 'id' | 'documentUrl'>;
  file: File | null;
};

@Component({
  selector: 'app-prescription-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submitForm()">
      <fieldset class="space-y-3">
        <legend class="sr-only">
          {{
            (initial()
              ? 'medical.prescription.form.legendEdit'
              : 'medical.prescription.form.legendCreate'
            ) | transloco
          }}
        </legend>

        <div>
          <label for="presc-patient" class="form-label">
            {{ 'medical.prescription.form.patient' | transloco }}
            <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <select
            id="presc-patient"
            formControlName="patientId"
            aria-required="true"
            class="form-select"
          >
            <option value="">
              {{ 'medical.prescription.form.patientPlaceholder' | transloco }}
            </option>
            @for (p of patients(); track p.id) {
              <option [value]="p.id">{{ p.firstName }} {{ p.lastName }}</option>
            }
          </select>
          @if (form.controls.patientId.touched && form.controls.patientId.errors?.['required']) {
            <small class="error" role="alert">{{
              'medical.prescription.form.patientRequired' | transloco
            }}</small>
          }
        </div>

        <div>
          <label for="presc-practitioner" class="form-label">{{
            'medical.prescription.form.practitioner' | transloco
          }}</label>
          <select id="presc-practitioner" formControlName="practitionerId" class="form-select">
            <option value="">
              {{ 'medical.prescription.form.practitionerPlaceholder' | transloco }}
            </option>
            @for (pr of practitioners(); track pr.id) {
              <option [value]="pr.id">
                {{ pr.name }} ({{ 'medical.practitioner.types.' + pr.type | transloco }})
              </option>
            }
          </select>
        </div>

        <div>
          <label for="presc-appointment" class="form-label">{{
            'medical.prescription.form.appointment' | transloco
          }}</label>
          <select id="presc-appointment" formControlName="appointmentId" class="form-select">
            <option value="">
              {{ 'medical.prescription.form.appointmentPlaceholder' | transloco }}
            </option>
            @for (a of appointments(); track a.id) {
              <option [value]="a.id">{{ a.date }} {{ a.time }}</option>
            }
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="presc-issued" class="form-label">
              {{ 'medical.prescription.form.issued' | transloco }}
              <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <input
              id="presc-issued"
              type="date"
              formControlName="issuedDate"
              aria-required="true"
              class="form-input"
            />
            @if (
              form.controls.issuedDate.touched && form.controls.issuedDate.errors?.['required']
            ) {
              <small class="error" role="alert">{{
                'medical.prescription.form.issuedRequired' | transloco
              }}</small>
            }
          </div>
          <div>
            <label for="presc-valid" class="form-label">{{
              'medical.prescription.form.validUntil' | transloco
            }}</label>
            <input id="presc-valid" type="date" formControlName="validUntil" class="form-input" />
          </div>
        </div>

        <div>
          <label for="presc-notes" class="form-label">{{
            'medical.prescription.form.notes' | transloco
          }}</label>
          <textarea id="presc-notes" formControlName="notes" rows="3" class="form-input"></textarea>
        </div>

        <!-- Drag & drop document -->
        <div>
          <span class="form-label" id="prescription-document-label">{{
            'medical.prescription.form.documentLabel' | transloco
          }}</span>
          <div
            role="group"
            aria-labelledby="prescription-document-label"
            class="relative rounded-lg border-2 border-dashed p-4 text-center transition-colors"
            [class.border-ib-purple]="isDragging()"
            [class.bg-ib-purple-5]="isDragging()"
            [class.border-border]="!isDragging()"
            (dragover)="onDragOver($event)"
            (dragleave)="onDragLeave()"
            (drop)="onDrop($event)"
          >
            @if (selectedFile()) {
              <div class="flex items-center justify-center gap-2">
                <span class="text-sm text-ib-purple font-medium">{{ selectedFile()!.name }}</span>
                <span class="text-xs text-text-muted">{{
                  'medical.prescription.form.selectedFileSize'
                    | transloco: { size: formatSize(selectedFile()!.size) }
                }}</span>
                <button
                  type="button"
                  class="text-xs text-ib-red hover:underline"
                  (click)="removeFile()"
                >
                  {{ 'medical.prescription.form.removeFile' | transloco }}
                </button>
              </div>
            } @else {
              <p class="text-sm text-text-muted">
                {{ 'medical.prescription.form.dropHere' | transloco }}
                <label class="text-ib-purple cursor-pointer hover:underline">
                  {{ 'medical.prescription.form.browse' | transloco }}
                  <input
                    type="file"
                    class="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    (change)="onFileSelected($event)"
                  />
                </label>
              </p>
              <p class="text-xs text-text-muted mt-1">
                {{ 'medical.prescription.form.fileHint' | transloco }}
              </p>
            }
          </div>
        </div>
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">
          {{ 'common.cancel' | transloco }}
        </button>
        <button type="submit" [disabled]="isInvalid()" class="btn-submit bg-ib-purple">
          {{
            (initial() ? 'medical.prescription.form.save' : 'medical.prescription.form.create')
              | transloco
          }}
        </button>
      </footer>
    </form>
  `,
})
export class PrescriptionForm {
  readonly initial = input<Prescription | null>(null);
  readonly patients = input<Patient[]>([]);
  readonly practitioners = input<Practitioner[]>([]);
  readonly appointments = input<Appointment[]>([]);
  readonly submitted = output<PrescriptionSubmitData>();
  readonly cancelled = output<void>();

  protected readonly isDragging = signal(false);
  protected readonly selectedFile = signal<File | null>(null);

  protected readonly form = new FormGroup<PrescriptionFormShape>({
    patientId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    practitionerId: new FormControl('', { nonNullable: true }),
    appointmentId: new FormControl('', { nonNullable: true }),
    issuedDate: new FormControl(new Date().toISOString().slice(0, 10), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    validUntil: new FormControl('', { nonNullable: true }),
    notes: new FormControl('', { nonNullable: true }),
  });

  protected readonly isInvalid = toSignal(
    this.form.statusChanges.pipe(map(() => this.form.invalid)),
    { initialValue: this.form.invalid },
  );

  private readonly ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  private readonly MAX_SIZE = 10 * 1024 * 1024;

  constructor() {
    effect(() => {
      const data = this.initial();
      if (data) {
        this.form.patchValue({
          patientId: data.patientId,
          practitionerId: data.practitionerId ?? '',
          appointmentId: data.appointmentId ?? '',
          issuedDate: data.issuedDate,
          validUntil: data.validUntil ?? '',
          notes: data.notes ?? '',
        });
        this.selectedFile.set(null);
      } else {
        this.form.reset();
        this.selectedFile.set(null);
      }
    });
  }

  protected onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  protected onDragLeave() {
    this.isDragging.set(false);
  }

  protected onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.validateAndSetFile(file);
  }

  protected onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.validateAndSetFile(file);
    input.value = '';
  }

  protected removeFile() {
    this.selectedFile.set(null);
  }

  protected formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected submitForm() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.submitted.emit({
      data: {
        patientId: v.patientId,
        practitionerId: v.practitionerId || null,
        appointmentId: v.appointmentId || null,
        issuedDate: v.issuedDate,
        validUntil: v.validUntil || null,
        notes: v.notes || null,
      },
      file: this.selectedFile(),
    });
  }

  private validateAndSetFile(file: File) {
    if (!this.ALLOWED_TYPES.includes(file.type)) return;
    if (file.size > this.MAX_SIZE) return;
    this.selectedFile.set(file);
  }
}
