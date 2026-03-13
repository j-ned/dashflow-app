import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
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
  imports: [ReactiveFormsModule],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submitForm()">
      <fieldset class="space-y-3">
        <legend class="sr-only">{{ initial() ? 'Modifier ordonnance' : 'Nouvelle ordonnance' }}</legend>

        <div>
          <label for="presc-patient" class="form-label">
            Patient <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <select id="presc-patient" formControlName="patientId" aria-required="true"
                  class="form-select">
            <option value="">-- Sélectionner un patient --</option>
            @for (p of patients(); track p.id) {
              <option [value]="p.id">{{ p.firstName }} {{ p.lastName }}</option>
            }
          </select>
          @if (form.controls.patientId.touched && form.controls.patientId.errors?.['required']) {
            <small class="error" role="alert">Le patient est obligatoire.</small>
          }
        </div>

        <div>
          <label for="presc-practitioner" class="form-label">Médecin prescripteur</label>
          <select id="presc-practitioner" formControlName="practitionerId"
                  class="form-select">
            <option value="">-- Aucun --</option>
            @for (pr of practitioners(); track pr.id) {
              <option [value]="pr.id">{{ pr.name }} ({{ pr.type }})</option>
            }
          </select>
        </div>

        <div>
          <label for="presc-appointment" class="form-label">Rendez-vous lié</label>
          <select id="presc-appointment" formControlName="appointmentId"
                  class="form-select">
            <option value="">-- Aucun --</option>
            @for (a of appointments(); track a.id) {
              <option [value]="a.id">{{ a.date }} {{ a.time }}</option>
            }
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="presc-issued" class="form-label">
              Date d'émission <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <input id="presc-issued" type="date" formControlName="issuedDate" aria-required="true"
                   class="form-input" />
            @if (form.controls.issuedDate.touched && form.controls.issuedDate.errors?.['required']) {
              <small class="error" role="alert">La date d'émission est obligatoire.</small>
            }
          </div>
          <div>
            <label for="presc-valid" class="form-label">Date de validité</label>
            <input id="presc-valid" type="date" formControlName="validUntil"
                   class="form-input" />
          </div>
        </div>

        <div>
          <label for="presc-notes" class="form-label">Notes</label>
          <textarea id="presc-notes" formControlName="notes" rows="3"
                    class="form-input"></textarea>
        </div>

        <!-- Drag & drop document -->
        <div>
          <label class="form-label">Document (PDF, image)</label>
          <div class="relative rounded-lg border-2 border-dashed p-4 text-center transition-colors"
               [class.border-ib-purple]="isDragging()"
               [class.bg-ib-purple-5]="isDragging()"
               [class.border-border]="!isDragging()"
               (dragover)="onDragOver($event)"
               (dragleave)="onDragLeave()"
               (drop)="onDrop($event)">
            @if (selectedFile()) {
              <div class="flex items-center justify-center gap-2">
                <span class="text-sm text-ib-purple font-medium">{{ selectedFile()!.name }}</span>
                <span class="text-xs text-text-muted">({{ formatSize(selectedFile()!.size) }})</span>
                <button type="button" class="text-xs text-ib-red hover:underline" (click)="removeFile()">Retirer</button>
              </div>
            } @else {
              <p class="text-sm text-text-muted">
                Glissez-déposez un fichier ici ou
                <label class="text-ib-purple cursor-pointer hover:underline">
                  parcourir
                  <input type="file" class="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                         (change)="onFileSelected($event)" />
                </label>
              </p>
              <p class="text-xs text-text-muted mt-1">PDF, JPG, PNG, WEBP — max 10 Mo</p>
            }
          </div>
        </div>
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">Annuler</button>
        <button type="submit" [disabled]="isInvalid()"
                class="btn-submit" style="background-color: var(--color-ib-purple)">
          {{ initial() ? 'Enregistrer' : 'Créer' }}
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
    issuedDate: new FormControl(new Date().toISOString().slice(0, 10), { nonNullable: true, validators: [Validators.required] }),
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
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
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
