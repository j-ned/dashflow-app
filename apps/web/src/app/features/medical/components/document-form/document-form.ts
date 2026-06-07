import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { MedicalDocument, DocumentType } from '../../domain/models/document.model';
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

const DOCUMENT_TYPES: DocumentType[] = ['compte_rendu', 'facture', 'bilan', 'certificat', 'courrier', 'autre'];

@Component({
  selector: 'app-document-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submitForm()">
      <fieldset class="space-y-3">
        <legend class="sr-only">{{ (initial() ? 'medical.document.form.legendEdit' : 'medical.document.form.legendCreate') | transloco }}</legend>

        <div>
          <label for="doc-patient" class="form-label">
            {{ 'medical.document.form.patient' | transloco }} <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <select id="doc-patient" formControlName="patientId" aria-required="true"
                  class="form-select">
            <option value="">{{ 'medical.document.form.patientPlaceholder' | transloco }}</option>
            @for (p of patients(); track p.id) {
              <option [value]="p.id">{{ p.firstName }} {{ p.lastName }}</option>
            }
          </select>
          @if (form.controls.patientId.touched && form.controls.patientId.errors?.['required']) {
            <small class="error" role="alert">{{ 'medical.document.form.patientRequired' | transloco }}</small>
          }
        </div>

        <div>
          <label for="doc-practitioner" class="form-label">{{ 'medical.document.form.practitioner' | transloco }}</label>
          <select id="doc-practitioner" formControlName="practitionerId"
                  class="form-select">
            <option value="">{{ 'medical.document.form.practitionerPlaceholder' | transloco }}</option>
            @for (pr of practitioners(); track pr.id) {
              <option [value]="pr.id">{{ pr.name }} ({{ ('medical.practitioner.types.' + pr.type) | transloco }})</option>
            }
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="doc-type" class="form-label">
              {{ 'medical.document.form.type' | transloco }} <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <select id="doc-type" formControlName="type" aria-required="true"
                    class="form-select">
              @for (t of documentTypes; track t) {
                <option [value]="t">{{ ('medical.document.types.' + t) | transloco }}</option>
              }
            </select>
          </div>
          <div>
            <label for="doc-date" class="form-label">
              {{ 'medical.document.form.date' | transloco }} <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <input id="doc-date" type="date" formControlName="date" aria-required="true"
                   class="form-input" />
            @if (form.controls.date.touched && form.controls.date.errors?.['required']) {
              <small class="error" role="alert">{{ 'medical.document.form.dateRequired' | transloco }}</small>
            }
          </div>
        </div>

        <div>
          <label for="doc-title" class="form-label">
            {{ 'medical.document.form.titleLabel' | transloco }} <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input id="doc-title" type="text" formControlName="title" aria-required="true"
                 [placeholder]="'medical.document.form.titlePlaceholder' | transloco"
                 class="form-input" />
          @if (form.controls.title.touched && form.controls.title.errors?.['required']) {
            <small class="error" role="alert">{{ 'medical.document.form.titleRequired' | transloco }}</small>
          }
        </div>

        <div>
          <label for="doc-notes" class="form-label">{{ 'medical.document.form.notes' | transloco }}</label>
          <textarea id="doc-notes" formControlName="notes" rows="2"
                    class="form-input"></textarea>
        </div>

        <!-- Drag & drop file -->
        <div>
          <span class="form-label" id="document-file-label">{{ 'medical.document.form.fileLabel' | transloco }}</span>
          <div role="group" aria-labelledby="document-file-label"
               class="relative rounded-lg border-2 border-dashed p-4 text-center transition-colors"
               [class.border-ib-purple]="isDragging()"
               [class.bg-ib-purple-5]="isDragging()"
               [class.border-border]="!isDragging()"
               (dragover)="onDragOver($event)"
               (dragleave)="onDragLeave()"
               (drop)="onDrop($event)">
            @if (selectedFile()) {
              <div class="flex items-center justify-center gap-2">
                <span class="text-sm text-ib-purple font-medium">{{ selectedFile()!.name }}</span>
                <span class="text-xs text-text-muted">{{ 'medical.document.form.selectedFileSize' | transloco: { size: formatSize(selectedFile()!.size) } }}</span>
                <button type="button" class="text-xs text-ib-red hover:underline" (click)="removeFile()">{{ 'medical.document.form.removeFile' | transloco }}</button>
              </div>
            } @else {
              <p class="text-sm text-text-muted">
                {{ 'medical.document.form.dropHere' | transloco }}
                <label class="text-ib-purple cursor-pointer hover:underline">
                  {{ 'medical.document.form.browse' | transloco }}
                  <input type="file" class="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                         (change)="onFileSelected($event)" />
                </label>
              </p>
              <p class="text-xs text-text-muted mt-1">{{ 'medical.document.form.fileHint' | transloco }}</p>
            }
          </div>
        </div>
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">{{ 'common.cancel' | transloco }}</button>
        <button type="submit" [disabled]="isInvalid()"
                class="btn-submit bg-ib-purple">
          {{ (initial() ? 'medical.document.form.save' : 'medical.document.form.create') | transloco }}
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

  protected readonly documentTypes = DOCUMENT_TYPES;

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
