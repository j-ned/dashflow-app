import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { lastValueFrom, switchMap } from 'rxjs';
import { Prescription } from '../../domain/models/prescription.model';
import { GetPrescriptionsUseCase } from '../../domain/use-cases/get-prescriptions.use-case';
import { CreatePrescriptionUseCase } from '../../domain/use-cases/create-prescription.use-case';
import { UpdatePrescriptionUseCase } from '../../domain/use-cases/update-prescription.use-case';
import { DeletePrescriptionUseCase } from '../../domain/use-cases/delete-prescription.use-case';
import { UploadPrescriptionDocumentUseCase } from '../../domain/use-cases/upload-prescription-document.use-case';
import { DeletePrescriptionDocumentUseCase } from '../../domain/use-cases/delete-prescription-document.use-case';
import { GetPatientsUseCase } from '../../domain/use-cases/get-patients.use-case';
import { GetPractitionersUseCase } from '../../domain/use-cases/get-practitioners.use-case';
import { GetAppointmentsUseCase } from '../../domain/use-cases/get-appointments.use-case';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { Icon } from '@shared/components/icon/icon';
import { PrescriptionForm, PrescriptionSubmitData } from '../../components/prescription-form/prescription-form';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-prescriptions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ModalDialog, PrescriptionForm, Icon],
  host: { class: 'block space-y-6' },
  template: `
    <header class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">Ordonnances</h2>
        <p class="mt-1 text-sm text-text-muted">Suivi des ordonnances médicales</p>
      </div>
      <button type="button"
              class="inline-flex items-center gap-1.5 rounded-lg bg-ib-purple px-4 py-2 text-sm font-medium text-white hover:bg-ib-purple/90 transition-colors shadow-sm"
              (click)="openCreateModal()">
        <app-icon name="plus" size="14" /> Ajouter
      </button>
    </header>

    <section aria-label="Liste des ordonnances" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      @for (presc of prescriptions(); track presc.id) {
        <article class="group relative overflow-hidden rounded-xl border bg-surface transition-all"
                 [class.border-ib-red-30]="isExpired(presc)"
                 [class.border-border]="!isExpired(presc)"
                 [class.hover:border-ib-cyan-30]="!isExpired(presc)"
                 [class.hover:shadow-lg]="true"
                 [class.hover:shadow-ib-cyan-5]="!isExpired(presc)">
          <div class="absolute inset-y-0 left-0 w-1 rounded-l-xl" [class.bg-ib-red]="isExpired(presc)" [class.bg-ib-cyan]="!isExpired(presc)"></div>
          <div class="p-5">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-ib-cyan/10">
                  <app-icon name="file-text" size="16" class="text-ib-cyan" />
                </div>
                <h3 class="font-semibold text-text-primary">{{ patientName(presc.patientId) }}</h3>
              </div>
              @if (isExpired(presc)) {
                <span class="rounded-full px-2 py-0.5 text-[10px] font-medium bg-ib-red/10 text-ib-red">Expirée</span>
              } @else if (presc.validUntil) {
                <span class="rounded-full px-2 py-0.5 text-[10px] font-medium bg-ib-green/10 text-ib-green">Valide</span>
              }
            </div>

            @if (practitionerName(presc.practitionerId); as pName) {
              <p class="text-xs text-text-muted mb-2 ml-10">Prescripteur : <span class="font-medium text-ib-purple">{{ pName }}</span></p>
            }

            <dl class="grid grid-cols-2 gap-2 text-xs mb-3 ml-10">
              <div>
                <dt class="text-text-muted">Émission</dt>
                <dd class="font-mono text-text-primary">{{ presc.issuedDate | date:'d MMMM yyyy' }}</dd>
              </div>
              <div>
                <dt class="text-text-muted">Validité</dt>
                <dd class="font-mono" [class.text-ib-red]="isExpired(presc)" [class.text-text-primary]="!isExpired(presc)">
                  {{ presc.validUntil ? (presc.validUntil | date:'d MMMM yyyy') : 'Non définie' }}
                </dd>
              </div>
            </dl>

            @if (appointmentDate(presc.appointmentId); as aDate) {
              <p class="text-xs text-text-muted mb-2 ml-10">
                RDV lié : <span class="font-mono text-ib-purple">{{ aDate }}</span>
              </p>
            }

            @if (presc.notes) {
              <p class="text-sm text-text-muted line-clamp-2 mb-2 ml-10">{{ presc.notes }}</p>
            }

            <!-- Document -->
            <div class="mt-2 mb-3 ml-10">
              @if (presc.documentUrl) {
                <div class="flex items-center gap-2 rounded-lg bg-ib-purple/5 border border-ib-purple/20 p-2">
                  <span class="text-xs font-medium text-ib-purple">Document joint</span>
                  <a [href]="presc.documentUrl" target="_blank" rel="noopener"
                     class="text-xs text-ib-blue hover:underline ml-auto">Voir</a>
                  <button type="button" class="text-xs text-ib-red hover:underline"
                          (click)="deleteDocument(presc.id)">Retirer</button>
                </div>
              } @else {
                <label class="flex items-center gap-2 rounded-lg border border-dashed border-border p-2 cursor-pointer hover:border-ib-purple/30 transition-colors">
                  <span class="text-xs text-text-muted">Joindre un document (PDF, image)</span>
                  <input type="file" class="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                         (change)="uploadDocument(presc.id, $event)" />
                </label>
              }
            </div>

            <div class="flex gap-2 pt-3 border-t border-border/50 ml-10">
              <button type="button"
                      class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:text-ib-yellow hover:border-ib-yellow/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-yellow"
                      (click)="openEditModal(presc)">
                Modifier
              </button>
              <button type="button"
                      class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-red"
                      (click)="deletePrescription(presc.id)">
                Supprimer
              </button>
            </div>
          </div>
        </article>
      } @empty {
        <div class="col-span-full text-center py-16 rounded-xl border border-dashed border-border bg-surface">
          <app-icon name="file-text" size="48" class="text-text-muted/20 mx-auto mb-3" />
          <p class="text-sm text-text-muted">Aucune ordonnance</p>
          <p class="text-xs text-text-muted mt-1">Ajoutez votre première ordonnance</p>
        </div>
      }
    </section>

    <app-modal-dialog #createModal title="Nouvelle ordonnance" (closed)="onModalClosed()">
      <app-prescription-form [patients]="patients()" [practitioners]="practitioners()" [appointments]="appointments()" (submitted)="createPrescription($event)" (cancelled)="createModal.close()" />
    </app-modal-dialog>

    <app-modal-dialog #editModal title="Modifier l'ordonnance" (closed)="onModalClosed()">
      <app-prescription-form [initial]="selectedPrescription()" [patients]="patients()" [practitioners]="practitioners()" [appointments]="appointments()" (submitted)="updatePrescription($event)" (cancelled)="editModal.close()" />
    </app-modal-dialog>
  `,
})
export class Prescriptions {
  private readonly getPrescriptions = inject(GetPrescriptionsUseCase);
  private readonly createPrescriptionUC = inject(CreatePrescriptionUseCase);
  private readonly updatePrescriptionUC = inject(UpdatePrescriptionUseCase);
  private readonly deletePrescriptionUC = inject(DeletePrescriptionUseCase);
  private readonly uploadDocumentUC = inject(UploadPrescriptionDocumentUseCase);
  private readonly deleteDocumentUC = inject(DeletePrescriptionDocumentUseCase);
  private readonly getPatientsUC = inject(GetPatientsUseCase);
  private readonly getPractitionersUC = inject(GetPractitionersUseCase);
  private readonly getAppointmentsUC = inject(GetAppointmentsUseCase);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(ConfirmService);

  private readonly createModalRef = viewChild.required<ModalDialog>('createModal');
  private readonly editModalRef = viewChild.required<ModalDialog>('editModal');

  private readonly _refresh = signal(0);
  protected readonly prescriptions = toSignal(
    toObservable(this._refresh).pipe(switchMap(() => this.getPrescriptions.execute())),
    { initialValue: [] },
  );

  protected readonly patients = toSignal(this.getPatientsUC.execute(), { initialValue: [] });
  protected readonly practitioners = toSignal(this.getPractitionersUC.execute(), { initialValue: [] });
  protected readonly appointments = toSignal(this.getAppointmentsUC.execute(), { initialValue: [] });

  protected readonly selectedPrescription = signal<Prescription | null>(null);

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

  private readonly appointmentMap = computed(() => {
    const map = new Map<string, string>();
    for (const a of this.appointments()) {
      map.set(a.id, `${a.date} ${a.time}`);
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

  protected appointmentDate(id: string | null): string | null {
    if (!id) return null;
    return this.appointmentMap().get(id) ?? null;
  }

  protected openCreateModal() {
    this.createModalRef().open();
  }

  protected openEditModal(item: Prescription) {
    this.selectedPrescription.set(item);
    this.editModalRef().open();
  }

  protected onModalClosed() {
    this.selectedPrescription.set(null);
  }

  protected isExpired(presc: Prescription): boolean {
    if (!presc.validUntil) return false;
    return presc.validUntil < new Date().toISOString().slice(0, 10);
  }

  protected async uploadDocument(prescriptionId: string, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await lastValueFrom(this.uploadDocumentUC.execute(prescriptionId, file));
      this.toaster.success('Document ajouté');
      this._refresh.update(v => v + 1);
    } catch {
      this.toaster.error('Erreur lors de l\'ajout du document');
    }
    input.value = '';
  }

  protected async deleteDocument(prescriptionId: string) {
    if (!await this.confirm.confirm({ title: 'Retirer le document', message: 'Retirer le document attaché à cette ordonnance ?', confirmLabel: 'Retirer', variant: 'warning' })) return;
    try {
      await lastValueFrom(this.deleteDocumentUC.execute(prescriptionId));
      this.toaster.success('Document retiré');
      this._refresh.update(v => v + 1);
    } catch {
      this.toaster.error('Erreur lors du retrait du document');
    }
  }

  protected async createPrescription({ data, file }: PrescriptionSubmitData) {
    try {
      const created = await lastValueFrom(this.createPrescriptionUC.execute(data));
      if (file) {
        try {
          await lastValueFrom(this.uploadDocumentUC.execute(created.id, file));
          this.toaster.success('Ordonnance créée');
          this.createModalRef().close();
          this._refresh.update(v => v + 1);
        } catch {
          this.toaster.error('Erreur lors de l\'ajout du document');
        }
      } else {
        this.toaster.success('Ordonnance créée');
        this.createModalRef().close();
        this._refresh.update(v => v + 1);
      }
    } catch {
      this.toaster.error('Erreur lors de la création');
    }
  }

  protected async updatePrescription({ data, file }: PrescriptionSubmitData) {
    const id = this.selectedPrescription()?.id;
    if (!id) return;
    try {
      await lastValueFrom(this.updatePrescriptionUC.execute(id, data));
      if (file) {
        try {
          await lastValueFrom(this.uploadDocumentUC.execute(id, file));
          this.toaster.success('Ordonnance modifiée');
          this.editModalRef().close();
          this._refresh.update(v => v + 1);
        } catch {
          this.toaster.error('Erreur lors de l\'ajout du document');
        }
      } else {
        this.toaster.success('Ordonnance modifiée');
        this.editModalRef().close();
        this._refresh.update(v => v + 1);
      }
    } catch {
      this.toaster.error('Erreur lors de la modification');
    }
  }

  protected async deletePrescription(id: string) {
    if (!await this.confirm.delete('cette ordonnance')) return;
    try {
      await lastValueFrom(this.deletePrescriptionUC.execute(id));
      this.toaster.success('Ordonnance supprimée');
      this._refresh.update(v => v + 1);
    } catch {
      this.toaster.error('Erreur lors de la suppression');
    }
  }
}
