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
import { Prescription } from '../../domain/models/prescription.model';
import { PrescriptionGateway } from '../../domain/gateways/prescription.gateway';
import { PatientGateway } from '../../domain/gateways/patient.gateway';
import { PractitionerGateway } from '../../domain/gateways/practitioner.gateway';
import { AppointmentGateway } from '../../domain/gateways/appointment.gateway';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { Icon } from '@shared/components/icon/icon';
import {
  PrescriptionForm,
  PrescriptionSubmitData,
} from '../../components/prescription-form/prescription-form';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-prescriptions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ModalDialog, PrescriptionForm, Icon, TranslocoPipe],
  host: { class: 'block space-y-6' },
  template: `
    <header class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">
          {{ 'medical.prescription.title' | transloco }}
        </h2>
        <p class="mt-1 text-sm text-text-muted">
          {{ 'medical.prescription.subtitle' | transloco }}
        </p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg bg-ib-purple px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-purple/90 transition-colors shadow-sm"
        (click)="openCreateModal()"
      >
        <app-icon name="plus" size="14" /> {{ 'medical.prescription.create' | transloco }}
      </button>
    </header>

    <section
      [attr.aria-label]="'medical.prescription.listLabel' | transloco"
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      @for (presc of prescriptions(); track presc.id) {
        <article
          class="group relative overflow-hidden rounded-xl border bg-surface transition"
          [class.border-ib-red-30]="isExpired(presc)"
          [class.border-border]="!isExpired(presc)"
          [class.hover:border-ib-cyan-30]="!isExpired(presc)"
          [class.hover:shadow-lg]="true"
          [class.hover:shadow-ib-cyan-5]="!isExpired(presc)"
        >
          <div class="p-5">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-ib-cyan/10">
                  <app-icon name="file-text" size="16" class="text-ib-cyan" />
                </div>
                <h3 class="font-semibold text-text-primary">{{ patientName(presc.patientId) }}</h3>
              </div>
              @if (isExpired(presc)) {
                <span
                  class="rounded-full px-2 py-0.5 text-[10px] font-medium bg-ib-red/10 text-ib-red"
                  >{{ 'medical.prescription.expired' | transloco }}</span
                >
              } @else if (presc.validUntil) {
                <span
                  class="rounded-full px-2 py-0.5 text-[10px] font-medium bg-ib-green/10 text-ib-green"
                  >{{ 'medical.prescription.valid' | transloco }}</span
                >
              }
            </div>

            @if (practitionerName(presc.practitionerId); as pName) {
              <p class="text-xs text-text-muted mb-2 ml-10">
                {{ 'medical.prescription.prescriberLabel' | transloco }} :
                <span class="font-medium text-ib-purple">{{ pName }}</span>
              </p>
            }

            <dl class="grid grid-cols-2 gap-2 text-xs mb-3 ml-10">
              <div>
                <dt class="text-text-muted">
                  {{ 'medical.prescription.issuedLabel' | transloco }}
                </dt>
                <dd class="font-mono text-text-primary">
                  {{ presc.issuedDate | date: 'd MMMM yyyy' }}
                </dd>
              </div>
              <div>
                <dt class="text-text-muted">
                  {{ 'medical.prescription.validityLabel' | transloco }}
                </dt>
                <dd
                  class="font-mono"
                  [class.text-ib-red]="isExpired(presc)"
                  [class.text-text-primary]="!isExpired(presc)"
                >
                  {{
                    presc.validUntil
                      ? (presc.validUntil | date: 'd MMMM yyyy')
                      : ('medical.prescription.validityNone' | transloco)
                  }}
                </dd>
              </div>
            </dl>

            @if (appointmentDate(presc.appointmentId); as aDate) {
              <p class="text-xs text-text-muted mb-2 ml-10">
                {{ 'medical.prescription.linkedAppointment' | transloco }} :
                <span class="font-mono text-ib-purple">{{ aDate }}</span>
              </p>
            }

            @if (presc.notes) {
              <p class="text-sm text-text-muted line-clamp-2 mb-2 ml-10">{{ presc.notes }}</p>
            }

            <!-- Document -->
            <div class="mt-2 mb-3 ml-10">
              @if (presc.documentUrl) {
                <div
                  class="flex items-center gap-2 rounded-lg bg-ib-purple/5 border border-ib-purple/20 p-2"
                >
                  <span class="text-xs font-medium text-ib-purple">{{
                    'medical.prescription.documentAttached' | transloco
                  }}</span>
                  <button
                    type="button"
                    class="text-xs text-ib-blue hover:underline ml-auto"
                    (click)="openDocument(presc.id)"
                  >
                    {{ 'medical.prescription.view' | transloco }}
                  </button>
                  <button
                    type="button"
                    class="text-xs text-ib-red hover:underline"
                    (click)="deleteDocument(presc.id)"
                  >
                    {{ 'medical.prescription.remove' | transloco }}
                  </button>
                </div>
              } @else {
                <label
                  class="flex items-center gap-2 rounded-lg border border-dashed border-border p-2 cursor-pointer hover:border-ib-purple/30 transition-colors"
                >
                  <span class="text-xs text-text-muted">{{
                    'medical.prescription.attachHint' | transloco
                  }}</span>
                  <input
                    type="file"
                    class="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    (change)="uploadDocument(presc.id, $event)"
                  />
                </label>
              }
            </div>

            <div class="flex gap-2 pt-3 border-t border-border/50 ml-10">
              <button
                type="button"
                class="rounded-lg border border-border px-3 py-1.5 text-xs min-h-8 font-medium text-text-muted hover:text-ib-yellow hover:border-ib-yellow/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-yellow"
                (click)="openEditModal(presc)"
              >
                {{ 'common.edit' | transloco }}
              </button>
              <button
                type="button"
                class="rounded-lg border border-border px-3 py-1.5 text-xs min-h-8 font-medium text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-red"
                (click)="deletePrescription(presc.id)"
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
          <app-icon name="file-text" size="48" class="text-text-muted/20 mx-auto mb-3" />
          <p class="text-sm text-text-muted">{{ 'medical.prescription.empty' | transloco }}</p>
          <p class="text-xs text-text-muted mt-1">
            {{ 'medical.prescription.emptyHint' | transloco }}
          </p>
        </div>
      }
    </section>

    <app-modal-dialog
      #createModal
      [title]="'medical.prescription.modalCreateTitle' | transloco"
      (closed)="onModalClosed()"
    >
      @if (createModal.isOpen()) {
        <app-prescription-form
          [patients]="patients()"
          [practitioners]="practitioners()"
          [appointments]="appointments()"
          (submitted)="createPrescription($event)"
          (cancelled)="createModal.close()"
        />
      }
    </app-modal-dialog>

    <app-modal-dialog
      #editModal
      [title]="'medical.prescription.modalEditTitle' | transloco"
      (closed)="onModalClosed()"
    >
      @if (editModal.isOpen()) {
        <app-prescription-form
          [initial]="selectedPrescription()"
          [patients]="patients()"
          [practitioners]="practitioners()"
          [appointments]="appointments()"
          (submitted)="updatePrescription($event)"
          (cancelled)="editModal.close()"
        />
      }
    </app-modal-dialog>
  `,
})
export class Prescriptions {
  private readonly prescriptionGw = inject(PrescriptionGateway);
  private readonly patientGw = inject(PatientGateway);
  private readonly practitionerGw = inject(PractitionerGateway);
  private readonly appointmentGw = inject(AppointmentGateway);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(ConfirmService);
  private readonly _i18n = inject(TranslocoService);

  private readonly createModalRef = viewChild.required<ModalDialog>('createModal');
  private readonly editModalRef = viewChild.required<ModalDialog>('editModal');

  private readonly _refresh = signal(0);
  protected readonly prescriptions = toSignal(
    toObservable(this._refresh).pipe(switchMap(() => this.prescriptionGw.getAll())),
    { initialValue: [] },
  );

  protected readonly patients = toSignal(this.patientGw.getAll(), { initialValue: [] });
  protected readonly practitioners = toSignal(this.practitionerGw.getAll(), { initialValue: [] });
  protected readonly appointments = toSignal(this.appointmentGw.getAll(), { initialValue: [] });

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
    return (
      this.patientMap().get(id) ?? this._i18n.translate('medical.dashboard.unknownPractitioner')
    );
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

  protected async openDocument(id: string) {
    const blob = await lastValueFrom(this.prescriptionGw.downloadDocument(id));
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  protected async uploadDocument(prescriptionId: string, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await lastValueFrom(this.prescriptionGw.uploadDocument(prescriptionId, file));
      this.toaster.success('medical.prescription.feedback.documentAdded');
      this._refresh.update((v) => v + 1);
    } catch {
      this.toaster.error('medical.prescription.feedback.documentAddFailed');
    }
    input.value = '';
  }

  protected async deleteDocument(prescriptionId: string) {
    if (
      !(await this.confirm.confirm({
        title: this._i18n.translate('medical.prescription.removeDocumentTitle'),
        message: this._i18n.translate('medical.prescription.removeDocumentMessage'),
        confirmLabel: this._i18n.translate('medical.prescription.removeDocumentConfirm'),
        variant: 'warning',
      }))
    )
      return;
    try {
      await lastValueFrom(this.prescriptionGw.deleteDocument(prescriptionId));
      this.toaster.success('medical.prescription.feedback.documentRemoved');
      this._refresh.update((v) => v + 1);
    } catch {
      this.toaster.error('medical.prescription.feedback.documentRemoveFailed');
    }
  }

  protected async createPrescription({ data, file }: PrescriptionSubmitData) {
    try {
      const created = await lastValueFrom(this.prescriptionGw.create(data));
      let fileFailed = false;
      if (file) {
        try {
          await lastValueFrom(this.prescriptionGw.uploadDocument(created.id, file));
        } catch {
          fileFailed = true;
        }
      }
      if (fileFailed) {
        this.toaster.error('medical.prescription.feedback.documentAddFailed');
      } else {
        this.toaster.success('medical.prescription.feedback.created');
      }
      this.createModalRef().close();
      this._refresh.update((v) => v + 1);
    } catch {
      this.toaster.error('medical.prescription.feedback.createFailed');
    }
  }

  protected async updatePrescription({ data, file }: PrescriptionSubmitData) {
    const id = this.selectedPrescription()?.id;
    if (!id) return;
    try {
      await lastValueFrom(this.prescriptionGw.update(id, data));
      let fileFailed = false;
      if (file) {
        try {
          await lastValueFrom(this.prescriptionGw.uploadDocument(id, file));
        } catch {
          fileFailed = true;
        }
      }
      if (fileFailed) {
        this.toaster.error('medical.prescription.feedback.documentAddFailed');
      } else {
        this.toaster.success('medical.prescription.feedback.updated');
      }
      this.editModalRef().close();
      this._refresh.update((v) => v + 1);
    } catch {
      this.toaster.error('medical.prescription.feedback.updateFailed');
    }
  }

  protected async deletePrescription(id: string) {
    if (!(await this.confirm.delete(this._i18n.translate('medical.prescription.deleteEntityName'))))
      return;
    try {
      await lastValueFrom(this.prescriptionGw.delete(id));
      this.toaster.success('medical.prescription.feedback.deleted');
      this._refresh.update((v) => v + 1);
    } catch {
      this.toaster.error('medical.prescription.feedback.deleteFailed');
    }
  }
}
