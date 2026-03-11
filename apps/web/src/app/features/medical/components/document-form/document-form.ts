import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
import { MedicalDocument, DocumentType, DOCUMENT_TYPE_LABELS } from '../../domain/models/document.model';
import { Patient } from '../../domain/models/patient.model';
import { Practitioner } from '../../domain/models/practitioner.model';

type DocumentFormShape = {
  patientId: FormControl<string>;
  practitionerId: FormControl<string>;
  type: FormControl<DocumentType>;
  title: FormControl<string>;
  date: FormControl<string>;
  notes: FormControl<string>;
};

export type DocumentSubmitData = {
  data: Omit<MedicalDocument, 'id' | 'fileUrl'>;
  file: File | null;
};

@Component({
  selector: 'app-document-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submitForm()">
      <fieldset class="space-y-3">
        <legend class="sr-only">{{ initial() ? 'Modifier document' : 'Nouveau document' }}</legend>

        <div>
          <label for="doc-patient" class="form-label">
            Patient <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <select id="doc-patient" formControlName="patientId" aria-required="true"
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
          <label for="doc-practitioner" class="form-label">Praticien associe</label>
          <select id="doc-practitioner" formControlName="practitionerId"
                  class="form-select">
            <option value="">-- Aucun --</option>
            @for (pr of practitioners(); track pr.id) {
              <option [value]="pr.id">{{ pr.name }} ({{ pr.type }})</option>
            }
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="doc-type" class="form-label">
              Type <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <select id="doc-type" formControlName="type" aria-required="true"
                    class="form-select">
              @for (opt of typeOptions; track opt.value) {
                <option [value]="opt.value">{{ opt.label }}</option>
              }
            </select>
          </div>
          <div>
            <label for="doc-date" class="form-label">
              Date <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <input id="doc-date" type="date" formControlName="date" aria-required="true"
                   class="form-input" />
            @if (form.controls.date.touched && form.controls.date.errors?.['required']) {
              <small class="error" role="alert">La date est obligatoire.</small>
            }
          </div>
        </div>

        <div>
          <label for="doc-title" class="form-label">
            Titre <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input id="doc-title" type="text" formControlName="title" aria-required="true"
                 placeholder="Ex: Bilan orthophonique, Facture ergotherapeute..."
                 class="form-input" />
          @if (form.controls.title.touched && form.controls.title.errors?.['required']) {
            <small class="error" role="alert">Le titre est obligatoire.</small>
          }
        </div>

        <div>
          <label for="doc-notes" class="form-label">Notes</label>
          <textarea id="doc-notes" formControlName="notes" rows="2"
                    class="form-input"></textarea>
        </div>

        <!-- Drag & drop file -->
        <div>
          <label class="form-label">Fichier (PDF, image)</label>
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
                Glissez-deposez un fichier ici ou
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
          {{ initial() ? 'Enregistrer' : 'Creer' }}
        </button>
      </footer>
    </form>
  `,
})
export class DocumentForm {
  readonly initial = input<MedicalDocument | null>(null);
  readonly patients = input<Patient[]>([]);
  readonly practitioners = input<Practitioner[]>([]);
  readonly submitted = output<DocumentSubmitData>();
  readonly cancelled = output<void>();

  protected readonly isDragging = signal(false);
  protected readonly selectedFile = signal<File | null>(null);

  protected readonly typeOptions = (Object.entries(DOCUMENT_TYPE_LABELS) as [DocumentType, string][])
    .map(([value, label]) => ({ value, label }));

  protected readonly form = new FormGroup<DocumentFormShape>({
    patientId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    practitionerId: new FormControl('', { nonNullable: true }),
    type: new FormControl<DocumentType>('compte_rendu', { nonNullable: true, validators: [Validators.required] }),
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    date: new FormControl(new Date().toISOString().slice(0, 10), { nonNullable: true, validators: [Validators.required] }),
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
          type: data.type,
          title: data.title,
          date: data.date,
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
        type: v.type,
        title: v.title,
        date: v.date,
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
