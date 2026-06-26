import { ChangeDetectionStrategy, Component, input, linkedSignal, output, signal } from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import { formatFileSize } from '@shared/forms/format-file-size';
import { MedicalDocument, DocumentType } from '../../domain/models/document.model';
import { Patient } from '../../domain/models/patient.model';
import { Practitioner } from '../../domain/models/practitioner.model';

type DocumentModel = {
  patientId: string;
  practitionerId: string;
  type: DocumentType;
  title: string;
  date: string;
  notes: string;
};

const EMPTY_MODEL: DocumentModel = {
  patientId: '',
  practitionerId: '',
  type: 'compte_rendu',
  title: '',
  date: '',
  notes: '',
};

export type DocumentSubmitData = {
  data: Omit<MedicalDocument, 'id' | 'fileUrl'>;
  file: File | null;
};

const DOCUMENT_TYPES: DocumentType[] = [
  'compte_rendu',
  'facture',
  'bilan',
  'certificat',
  'courrier',
  'autre',
];

@Component({
  selector: 'app-document-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <form (submit)="submitForm($event)">
      <fieldset class="space-y-3">
        <legend class="sr-only">
          {{
            (initial() ? 'medical.document.form.legendEdit' : 'medical.document.form.legendCreate')
              | transloco
          }}
        </legend>

        <div>
          <label for="doc-patient" class="form-label">
            {{ 'medical.document.form.patient' | transloco }}
            <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <select
            id="doc-patient"
            [formField]="documentForm.patientId"
            aria-required="true"
            class="form-select"
          >
            <option value="">{{ 'medical.document.form.patientPlaceholder' | transloco }}</option>
            @for (p of patients(); track p.id) {
              <option [value]="p.id">{{ p.firstName }} {{ p.lastName }}</option>
            }
          </select>
          @if (documentForm.patientId().touched() && documentForm.patientId().invalid()) {
            @for (err of documentForm.patientId().errors(); track err.message) {
              <small class="error" role="alert">{{ err.message | transloco }}</small>
            }
          }
        </div>

        <div>
          <label for="doc-practitioner" class="form-label">{{
            'medical.document.form.practitioner' | transloco
          }}</label>
          <select id="doc-practitioner" [formField]="documentForm.practitionerId" class="form-select">
            <option value="">
              {{ 'medical.document.form.practitionerPlaceholder' | transloco }}
            </option>
            @for (pr of practitioners(); track pr.id) {
              <option [value]="pr.id">
                {{ pr.name }} ({{ 'medical.practitioner.types.' + pr.type | transloco }})
              </option>
            }
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="doc-type" class="form-label">
              {{ 'medical.document.form.type' | transloco }}
              <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <select id="doc-type" [formField]="documentForm.type" aria-required="true" class="form-select">
              @for (t of documentTypes; track t) {
                <option [value]="t">{{ 'medical.document.types.' + t | transloco }}</option>
              }
            </select>
          </div>
          <div>
            <label for="doc-date" class="form-label">
              {{ 'medical.document.form.date' | transloco }}
              <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <input
              id="doc-date"
              type="date"
              [formField]="documentForm.date"
              aria-required="true"
              class="form-input"
            />
            @if (documentForm.date().touched() && documentForm.date().invalid()) {
              @for (err of documentForm.date().errors(); track err.message) {
                <small class="error" role="alert">{{ err.message | transloco }}</small>
              }
            }
          </div>
        </div>

        <div>
          <label for="doc-title" class="form-label">
            {{ 'medical.document.form.titleLabel' | transloco }}
            <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input
            id="doc-title"
            type="text"
            [formField]="documentForm.title"
            aria-required="true"
            [placeholder]="'medical.document.form.titlePlaceholder' | transloco"
            class="form-input"
          />
          @if (documentForm.title().touched() && documentForm.title().invalid()) {
            @for (err of documentForm.title().errors(); track err.message) {
              <small class="error" role="alert">{{ err.message | transloco }}</small>
            }
          }
        </div>

        <div>
          <label for="doc-notes" class="form-label">{{
            'medical.document.form.notes' | transloco
          }}</label>
          <textarea id="doc-notes" [formField]="documentForm.notes" rows="2" class="form-input"></textarea>
        </div>

        <!-- Drag & drop file -->
        <div>
          <span class="form-label" id="document-file-label">{{
            'medical.document.form.fileLabel' | transloco
          }}</span>
          <div
            role="group"
            aria-labelledby="document-file-label"
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
                  'medical.document.form.selectedFileSize'
                    | transloco: { size: formatSize(selectedFile()!.size) }
                }}</span>
                <button
                  type="button"
                  class="text-xs text-ib-red hover:underline"
                  (click)="removeFile()"
                >
                  {{ 'medical.document.form.removeFile' | transloco }}
                </button>
              </div>
            } @else {
              <p class="text-sm text-text-muted">
                {{ 'medical.document.form.dropHere' | transloco }}
                <label class="text-ib-purple cursor-pointer hover:underline">
                  {{ 'medical.document.form.browse' | transloco }}
                  <input
                    type="file"
                    class="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    (change)="onFileSelected($event)"
                  />
                </label>
              </p>
              <p class="text-xs text-text-muted mt-1">
                {{ 'medical.document.form.fileHint' | transloco }}
              </p>
            }
          </div>
        </div>
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">
          {{ 'common.cancel' | transloco }}
        </button>
        <button type="submit" [disabled]="documentForm().invalid()" class="btn-submit bg-ib-purple">
          {{
            (initial() ? 'medical.document.form.save' : 'medical.document.form.create') | transloco
          }}
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
  protected readonly formatSize = formatFileSize;

  // État dérivé modifiable : se réinitialise quand `initial` change, éditable par le form.
  protected readonly model = linkedSignal<DocumentModel>(() => {
    const data = this.initial();
    return data
      ? {
          patientId: data.patientId,
          practitionerId: data.practitionerId ?? '',
          type: data.type,
          title: data.title,
          date: data.date,
          notes: data.notes ?? '',
        }
      : { ...EMPTY_MODEL, date: new Date().toISOString().slice(0, 10) };
  });

  protected readonly documentForm = form(this.model, (path) => {
    required(path.patientId, { message: 'medical.document.form.patientRequired' });
    required(path.type, { message: 'medical.document.form.typeRequired' });
    required(path.title, { message: 'medical.document.form.titleRequired' });
    required(path.date, { message: 'medical.document.form.dateRequired' });
  });

  private readonly ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  private readonly MAX_SIZE = 10 * 1024 * 1024;

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

  protected async submitForm(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.documentForm, async () => {
      const v = this.model();
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
      return [];
    });
  }

  private validateAndSetFile(file: File) {
    if (!this.ALLOWED_TYPES.includes(file.type)) return;
    if (file.size > this.MAX_SIZE) return;
    this.selectedFile.set(file);
  }
}
