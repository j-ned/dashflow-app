import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { lastValueFrom, switchMap } from 'rxjs';
import { MedicalDocument, DOCUMENT_TYPE_LABELS } from '../../domain/models/document.model';
import { GetDocumentsUseCase } from '../../domain/use-cases/get-documents.use-case';
import { CreateDocumentUseCase } from '../../domain/use-cases/create-document.use-case';
import { UpdateDocumentUseCase } from '../../domain/use-cases/update-document.use-case';
import { DeleteDocumentUseCase } from '../../domain/use-cases/delete-document.use-case';
import { UploadDocumentFileUseCase } from '../../domain/use-cases/upload-document-file.use-case';
import { GetPatientsUseCase } from '../../domain/use-cases/get-patients.use-case';
import { GetPractitionersUseCase } from '../../domain/use-cases/get-practitioners.use-case';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { DocumentForm, DocumentSubmitData } from '../../components/document-form/document-form';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { Icon } from '@shared/components/icon/icon';

@Component({
  selector: 'app-documents',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ModalDialog, DocumentForm, Icon],
  host: { class: 'block space-y-6' },
  template: `
    <header class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">Documents</h2>
        <p class="mt-1 text-sm text-text-muted">Comptes rendus, factures, bilans et autres documents medicaux</p>
      </div>
      <button type="button"
              class="inline-flex items-center gap-1.5 rounded-lg bg-ib-purple px-4 py-2 text-sm font-medium text-white hover:bg-ib-purple/90 transition-colors shadow-sm"
              (click)="openCreateModal()">
        <app-icon name="plus" size="14" /> Ajouter
      </button>
    </header>

    <!-- Filters -->
    <div class="flex gap-2 flex-wrap items-center">
      <button type="button"
              class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors"
              [class.border-ib-purple]="!filterPatientId()"
              [class.bg-ib-purple]="!filterPatientId()"
              [class.text-white]="!filterPatientId()"
              [class.border-border]="filterPatientId()"
              [class.text-text-muted]="filterPatientId()"
              (click)="filterPatientId.set(null)">
        Tous
      </button>
      @for (p of patients(); track p.id) {
        <button type="button"
                class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                [class.border-ib-purple]="filterPatientId() === p.id"
                [class.bg-ib-purple]="filterPatientId() === p.id"
                [class.text-white]="filterPatientId() === p.id"
                [class.border-border]="filterPatientId() !== p.id"
                [class.text-text-muted]="filterPatientId() !== p.id"
                (click)="filterPatientId.set(p.id)">
          {{ p.firstName }} {{ p.lastName }}
        </button>
      }
    </div>

    <section aria-label="Liste des documents" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      @for (doc of filteredDocuments(); track doc.id) {
        <article class="group relative overflow-hidden rounded-xl border border-border bg-surface transition-all hover:border-ib-yellow/30 hover:shadow-lg hover:shadow-ib-yellow/5">
          <div class="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-ib-yellow"></div>
          <div class="p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-ib-yellow/10">
                <app-icon name="folder" size="16" class="text-ib-yellow" />
              </div>
              <h3 class="font-semibold text-text-primary truncate" [title]="doc.title">{{ doc.title }}</h3>
            </div>
            <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium bg-ib-purple/10 text-ib-purple">
              {{ typeLabel(doc.type) }}
            </span>
          </div>

          <dl class="grid grid-cols-2 gap-2 text-xs mb-3">
            <div>
              <dt class="text-text-muted">Patient</dt>
              <dd class="font-medium text-text-primary">{{ patientName(doc.patientId) }}</dd>
            </div>
            <div>
              <dt class="text-text-muted">Date</dt>
              <dd class="font-mono text-text-primary">{{ doc.date | date:'d MMMM yyyy' }}</dd>
            </div>
          </dl>

          @if (practitionerName(doc.practitionerId); as pName) {
            <p class="text-xs text-text-muted mb-2">Praticien : <span class="font-medium text-ib-purple">{{ pName }}</span></p>
          }

          @if (doc.notes) {
            <p class="text-sm text-text-muted line-clamp-2 mb-2">{{ doc.notes }}</p>
          }

          <!-- File -->
          <div class="mt-2 mb-3">
            @if (doc.fileUrl) {
              <div class="flex items-center gap-2 rounded-lg bg-ib-purple/5 border border-ib-purple/20 p-2">
                <span class="text-xs font-medium text-ib-purple">Fichier joint</span>
                <a [href]="doc.fileUrl" target="_blank" rel="noopener"
                   class="text-xs text-ib-blue hover:underline ml-auto">Voir</a>
              </div>
            } @else {
              <label class="flex items-center gap-2 rounded-lg border border-dashed border-border p-2 cursor-pointer hover:border-ib-purple/30 transition-colors">
                <span class="text-xs text-text-muted">Joindre un fichier (PDF, image)</span>
                <input type="file" class="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                       (change)="uploadFile(doc.id, $event)" />
              </label>
            }
          </div>

          <div class="flex gap-2 pt-3 border-t border-border/50">
            <button type="button"
                    class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:text-ib-yellow hover:border-ib-yellow/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-yellow"
                    (click)="openEditModal(doc)">
              Modifier
            </button>
            <button type="button"
                    class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-red"
                    (click)="deleteDoc(doc.id)">
              Supprimer
            </button>
          </div>
          </div>
        </article>
      } @empty {
        <div class="col-span-full text-center py-16 rounded-xl border border-dashed border-border bg-surface">
          <app-icon name="folder" size="48" class="text-text-muted/20 mx-auto mb-3" />
          <p class="text-sm text-text-muted">Aucun document</p>
          <p class="text-xs text-text-muted mt-1">Ajoutez vos documents medicaux</p>
        </div>
      }
    </section>

    <app-modal-dialog #createModal title="Nouveau document" (closed)="onModalClosed()">
      <app-document-form [patients]="patients()" [practitioners]="practitioners()" (submitted)="createDoc($event)" (cancelled)="createModal.close()" />
    </app-modal-dialog>

    <app-modal-dialog #editModal title="Modifier le document" (closed)="onModalClosed()">
      <app-document-form [initial]="selectedDocument()" [patients]="patients()" [practitioners]="practitioners()" (submitted)="updateDoc($event)" (cancelled)="editModal.close()" />
    </app-modal-dialog>
  `,
})
export class Documents {
  private readonly getDocuments = inject(GetDocumentsUseCase);
  private readonly createDocumentUC = inject(CreateDocumentUseCase);
  private readonly updateDocumentUC = inject(UpdateDocumentUseCase);
  private readonly deleteDocumentUC = inject(DeleteDocumentUseCase);
  private readonly uploadFileUC = inject(UploadDocumentFileUseCase);
  private readonly getPatientsUC = inject(GetPatientsUseCase);
  private readonly getPractitionersUC = inject(GetPractitionersUseCase);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(ConfirmService);

  private readonly createModalRef = viewChild.required<ModalDialog>('createModal');
  private readonly editModalRef = viewChild.required<ModalDialog>('editModal');

  private readonly _refresh = signal(0);
  protected readonly documents = toSignal(
    toObservable(this._refresh).pipe(switchMap(() => this.getDocuments.execute())),
    { initialValue: [] },
  );

  protected readonly patients = toSignal(this.getPatientsUC.execute(), { initialValue: [] });
  protected readonly practitioners = toSignal(this.getPractitionersUC.execute(), { initialValue: [] });

  protected readonly selectedDocument = signal<MedicalDocument | null>(null);
  protected readonly filterPatientId = signal<string | null>(null);

  protected readonly filteredDocuments = computed(() => {
    const docs = this.documents();
    const pid = this.filterPatientId();
    return pid ? docs.filter(d => d.patientId === pid) : docs;
  });

  private readonly patientMap = computed(() => {
    const map = new Map<string, string>();
    for (const p of this.patients()) {
      map.set(p.id, `${p.firstName} ${p.lastName}`);
    }
    return map;
  });

  private readonly practitionerMap = computed(() => {
    const map = new Map<string, string>();
    for (const pr of this.practitioners()) {
      map.set(pr.id, pr.name);
    }
    return map;
  });

  protected patientName(id: string): string {
    return this.patientMap().get(id) ?? 'Inconnu';
  }

  protected practitionerName(id: string | null): string | null {
    if (!id) return null;
    return this.practitionerMap().get(id) ?? null;
  }

  protected typeLabel(type: string): string {
    return DOCUMENT_TYPE_LABELS[type as keyof typeof DOCUMENT_TYPE_LABELS] ?? type;
  }

  protected openCreateModal() {
    this.createModalRef().open();
  }

  protected openEditModal(item: MedicalDocument) {
    this.selectedDocument.set(item);
    this.editModalRef().open();
  }

  protected onModalClosed() {
    this.selectedDocument.set(null);
  }

  protected async uploadFile(documentId: string, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await lastValueFrom(this.uploadFileUC.execute(documentId, file));
      this.toaster.success('Fichier ajoute');
      this._refresh.update(v => v + 1);
    } catch {
      this.toaster.error('Erreur lors de l\'ajout du fichier');
    }
    input.value = '';
  }

  protected async createDoc({ data, file }: DocumentSubmitData) {
    try {
      const created = await lastValueFrom(this.createDocumentUC.execute(data));
      if (file) {
        try {
          await lastValueFrom(this.uploadFileUC.execute(created.id, file));
          this.toaster.success('Document cree');
          this.createModalRef().close();
          this._refresh.update(v => v + 1);
        } catch {
          this.toaster.error('Erreur lors de l\'ajout du fichier');
        }
      } else {
        this.toaster.success('Document cree');
        this.createModalRef().close();
        this._refresh.update(v => v + 1);
      }
    } catch {
      this.toaster.error('Erreur lors de la creation');
    }
  }

  protected async updateDoc({ data, file }: DocumentSubmitData) {
    const id = this.selectedDocument()?.id;
    if (!id) return;
    try {
      await lastValueFrom(this.updateDocumentUC.execute(id, data));
      if (file) {
        try {
          await lastValueFrom(this.uploadFileUC.execute(id, file));
          this.toaster.success('Document modifie');
          this.editModalRef().close();
          this._refresh.update(v => v + 1);
        } catch {
          this.toaster.error('Erreur lors de l\'ajout du fichier');
        }
      } else {
        this.toaster.success('Document modifie');
        this.editModalRef().close();
        this._refresh.update(v => v + 1);
      }
    } catch {
      this.toaster.error('Erreur lors de la modification');
    }
  }

  protected async deleteDoc(id: string) {
    if (!await this.confirm.delete('ce document')) return;
    try {
      await lastValueFrom(this.deleteDocumentUC.execute(id));
      this.toaster.success('Document supprime');
      this._refresh.update(v => v + 1);
    } catch {
      this.toaster.error('Erreur lors de la suppression');
    }
  }
}
