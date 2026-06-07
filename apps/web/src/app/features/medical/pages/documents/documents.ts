import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { lastValueFrom, switchMap } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MedicalDocument } from '../../domain/models/document.model';
import { DocumentGateway } from '../../domain/gateways/document.gateway';
import { PatientGateway } from '../../domain/gateways/patient.gateway';
import { PractitionerGateway } from '../../domain/gateways/practitioner.gateway';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { DocumentForm, DocumentSubmitData } from '../../components/document-form/document-form';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { Icon } from '@shared/components/icon/icon';

@Component({
  selector: 'app-documents',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ModalDialog, DocumentForm, Icon, TranslocoPipe],
  host: { class: 'block space-y-6' },
  template: `
    <header class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">
          {{ 'medical.document.title' | transloco }}
        </h2>
        <p class="mt-1 text-sm text-text-muted">{{ 'medical.document.subtitle' | transloco }}</p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg bg-ib-purple px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-purple/90 transition-colors shadow-sm"
        (click)="openCreateModal()"
      >
        <app-icon name="plus" size="14" /> {{ 'medical.document.create' | transloco }}
      </button>
    </header>

    <!-- Filters -->
    <div class="flex gap-2 flex-wrap items-center">
      <button
        type="button"
        class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        [class.border-ib-purple]="!filterPatientId()"
        [class.bg-ib-purple]="!filterPatientId()"
        [class.text-canvas]="!filterPatientId()"
        [class.border-border]="filterPatientId()"
        [class.text-text-muted]="filterPatientId()"
        (click)="filterPatientId.set(null)"
      >
        {{ 'medical.document.filterAll' | transloco }}
      </button>
      @for (p of patients(); track p.id) {
        <button
          type="button"
          class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors"
          [class.border-ib-purple]="filterPatientId() === p.id"
          [class.bg-ib-purple]="filterPatientId() === p.id"
          [class.text-canvas]="filterPatientId() === p.id"
          [class.border-border]="filterPatientId() !== p.id"
          [class.text-text-muted]="filterPatientId() !== p.id"
          (click)="filterPatientId.set(p.id)"
        >
          {{ p.firstName }} {{ p.lastName }}
        </button>
      }
    </div>

    <section
      [attr.aria-label]="'medical.document.listLabel' | transloco"
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      @for (doc of filteredDocuments(); track doc.id) {
        <article
          class="group relative overflow-hidden rounded-xl border border-border bg-surface transition hover:border-ib-yellow/30 hover:shadow-lg hover:shadow-ib-yellow/5"
        >
          <div class="p-5">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-ib-yellow/10">
                  <app-icon name="folder" size="16" class="text-ib-yellow" />
                </div>
                <h3 class="font-semibold text-text-primary truncate" [title]="doc.title">
                  {{ doc.title }}
                </h3>
              </div>
              <span
                class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium bg-ib-purple/10 text-ib-purple"
              >
                {{ 'medical.document.types.' + doc.type | transloco }}
              </span>
            </div>

            <dl class="grid grid-cols-2 gap-2 text-xs mb-3">
              <div>
                <dt class="text-text-muted">{{ 'medical.document.patientLabel' | transloco }}</dt>
                <dd class="font-medium text-text-primary">{{ patientName(doc.patientId) }}</dd>
              </div>
              <div>
                <dt class="text-text-muted">{{ 'medical.document.dateLabel' | transloco }}</dt>
                <dd class="font-mono text-text-primary">{{ doc.date | date: 'd MMMM yyyy' }}</dd>
              </div>
            </dl>

            @if (practitionerName(doc.practitionerId); as pName) {
              <p class="text-xs text-text-muted mb-2">
                {{ 'medical.document.practitionerLabel' | transloco }} :
                <span class="font-medium text-ib-purple">{{ pName }}</span>
              </p>
            }

            @if (doc.notes) {
              <p class="text-sm text-text-muted line-clamp-2 mb-2">{{ doc.notes }}</p>
            }

            <!-- File -->
            <div class="mt-2 mb-3">
              @if (doc.fileUrl) {
                <div
                  class="flex items-center gap-2 rounded-lg bg-ib-purple/5 border border-ib-purple/20 p-2"
                >
                  <span class="text-xs font-medium text-ib-purple">{{
                    'medical.document.fileAttached' | transloco
                  }}</span>
                  <button
                    type="button"
                    class="text-xs text-ib-blue hover:underline ml-auto"
                    (click)="openFile(doc.id)"
                  >
                    {{ 'medical.document.view' | transloco }}
                  </button>
                </div>
              } @else {
                <label
                  class="flex items-center gap-2 rounded-lg border border-dashed border-border p-2 cursor-pointer hover:border-ib-purple/30 transition-colors"
                >
                  <span class="text-xs text-text-muted">{{
                    'medical.document.attachHint' | transloco
                  }}</span>
                  <input
                    type="file"
                    class="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    (change)="uploadFile(doc.id, $event)"
                  />
                </label>
              }
            </div>

            <div class="flex gap-2 pt-3 border-t border-border/50">
              <button
                type="button"
                class="rounded-lg border border-border px-3 py-1.5 text-xs min-h-8 font-medium text-text-muted hover:text-ib-yellow hover:border-ib-yellow/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-yellow"
                (click)="openEditModal(doc)"
              >
                {{ 'common.edit' | transloco }}
              </button>
              <button
                type="button"
                class="rounded-lg border border-border px-3 py-1.5 text-xs min-h-8 font-medium text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-red"
                (click)="deleteDoc(doc.id)"
              >
                {{ 'common.delete' | transloco }}
              </button>
            </div>
          </div>
        </article>
      } @empty {
        <div
          class="col-span-full text-center py-16 rounded-xl border border-dashed border-border bg-surface"
        >
          <app-icon name="folder" size="48" class="text-text-muted/20 mx-auto mb-3" />
          <p class="text-sm text-text-muted">{{ 'medical.document.empty' | transloco }}</p>
          <p class="text-xs text-text-muted mt-1">{{ 'medical.document.emptyHint' | transloco }}</p>
        </div>
      }
    </section>

    <app-modal-dialog
      #createModal
      [title]="'medical.document.modalCreateTitle' | transloco"
      (closed)="onModalClosed()"
    >
      @if (createModal.isOpen()) {
        <app-document-form
          [patients]="patients()"
          [practitioners]="practitioners()"
          (submitted)="createDoc($event)"
          (cancelled)="createModal.close()"
        />
      }
    </app-modal-dialog>

    <app-modal-dialog
      #editModal
      [title]="'medical.document.modalEditTitle' | transloco"
      (closed)="onModalClosed()"
    >
      @if (editModal.isOpen()) {
        <app-document-form
          [initial]="selectedDocument()"
          [patients]="patients()"
          [practitioners]="practitioners()"
          (submitted)="updateDoc($event)"
          (cancelled)="editModal.close()"
        />
      }
    </app-modal-dialog>
  `,
})
export class Documents {
  private readonly documentGw = inject(DocumentGateway);
  private readonly patientGw = inject(PatientGateway);
  private readonly practitionerGw = inject(PractitionerGateway);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(ConfirmService);
  private readonly _i18n = inject(TranslocoService);

  private readonly createModalRef = viewChild.required<ModalDialog>('createModal');
  private readonly editModalRef = viewChild.required<ModalDialog>('editModal');

  private readonly _refresh = signal(0);
  protected readonly documents = toSignal(
    toObservable(this._refresh).pipe(switchMap(() => this.documentGw.getAll())),
    { initialValue: [] },
  );

  protected readonly patients = toSignal(this.patientGw.getAll(), { initialValue: [] });
  protected readonly practitioners = toSignal(this.practitionerGw.getAll(), { initialValue: [] });

  protected readonly selectedDocument = signal<MedicalDocument | null>(null);
  protected readonly filterPatientId = signal<string | null>(null);

  protected readonly filteredDocuments = computed(() => {
    const docs = this.documents();
    const pid = this.filterPatientId();
    return pid ? docs.filter((d) => d.patientId === pid) : docs;
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
    return this.patientMap().get(id) ?? this._i18n.translate('medical.document.unknownPatient');
  }

  protected practitionerName(id: string | null): string | null {
    if (!id) return null;
    return this.practitionerMap().get(id) ?? null;
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

  protected async openFile(id: string) {
    const blob = await lastValueFrom(this.documentGw.downloadFile(id));
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  protected async uploadFile(documentId: string, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await lastValueFrom(this.documentGw.uploadFile(documentId, file));
      this.toaster.success('medical.document.feedback.fileAdded');
      this._refresh.update((v) => v + 1);
    } catch {
      this.toaster.error('medical.document.feedback.fileAddFailed');
    }
    input.value = '';
  }

  protected async createDoc({ data, file }: DocumentSubmitData) {
    try {
      const created = await lastValueFrom(this.documentGw.create(data));
      let fileFailed = false;
      if (file) {
        try {
          await lastValueFrom(this.documentGw.uploadFile(created.id, file));
        } catch {
          fileFailed = true;
        }
      }
      if (fileFailed) {
        this.toaster.error('medical.document.feedback.fileAddFailed');
      } else {
        this.toaster.success('medical.document.feedback.created');
      }
      this.createModalRef().close();
      this._refresh.update((v) => v + 1);
    } catch {
      this.toaster.error('medical.document.feedback.createFailed');
    }
  }

  protected async updateDoc({ data, file }: DocumentSubmitData) {
    const id = this.selectedDocument()?.id;
    if (!id) return;
    try {
      await lastValueFrom(this.documentGw.update(id, data));
      let fileFailed = false;
      if (file) {
        try {
          await lastValueFrom(this.documentGw.uploadFile(id, file));
        } catch {
          fileFailed = true;
        }
      }
      if (fileFailed) {
        this.toaster.error('medical.document.feedback.fileAddFailed');
      } else {
        this.toaster.success('medical.document.feedback.updated');
      }
      this.editModalRef().close();
      this._refresh.update((v) => v + 1);
    } catch {
      this.toaster.error('medical.document.feedback.updateFailed');
    }
  }

  protected async deleteDoc(id: string) {
    if (!(await this.confirm.delete(this._i18n.translate('medical.document.deleteEntityName'))))
      return;
    try {
      await lastValueFrom(this.documentGw.delete(id));
      this.toaster.success('medical.document.feedback.deleted');
      this._refresh.update((v) => v + 1);
    } catch {
      this.toaster.error('medical.document.feedback.deleteFailed');
    }
  }
}
