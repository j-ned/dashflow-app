import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { lastValueFrom, switchMap } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Patient } from '../../domain/models/patient.model';
import { PatientGateway } from '../../domain/gateways/patient.gateway';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { PatientForm } from '../../components/patient-form/patient-form';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { Icon } from '@shared/components/icon/icon';

@Component({
  selector: 'app-patients',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ModalDialog, PatientForm, Icon, TranslocoPipe],
  host: { class: 'block space-y-6' },
  template: `
    <header class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">
          {{ 'medical.patient.title' | transloco }}
        </h2>
        <p class="mt-1 text-sm text-text-muted">{{ 'medical.patient.subtitle' | transloco }}</p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg bg-ib-purple px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-purple/90 transition-colors shadow-sm"
        (click)="openCreateModal()"
      >
        <app-icon name="plus" size="14" /> {{ 'medical.patient.create' | transloco }}
      </button>
    </header>

    <section
      [attr.aria-label]="'medical.patient.listLabel' | transloco"
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      @for (patient of patients(); track patient.id) {
        <article
          class="group relative overflow-hidden rounded-xl border border-border bg-surface transition hover:border-ib-purple/30 hover:shadow-lg hover:shadow-ib-purple/5"
        >
          <div class="p-5">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-ib-purple/10">
                  <app-icon name="users" size="16" class="text-ib-purple" />
                </div>
                <h3 class="font-semibold text-text-primary">
                  {{ patient.firstName }} {{ patient.lastName }}
                </h3>
              </div>
            </div>

            <dl class="grid grid-cols-1 gap-1 text-sm ml-10">
              <div>
                <dt class="text-text-muted text-xs">
                  {{ 'medical.patient.birthDate' | transloco }}
                </dt>
                <dd class="text-text-primary">{{ patient.birthDate | date: 'd MMMM yyyy' }}</dd>
              </div>
              @if (patient.notes) {
                <div class="mt-1">
                  <dt class="text-text-muted text-xs">{{ 'medical.patient.notes' | transloco }}</dt>
                  <dd class="text-text-primary text-xs line-clamp-2">{{ patient.notes }}</dd>
                </div>
              }
            </dl>

            <div class="mt-4 flex gap-2 pt-3 border-t border-border/50">
              <button
                type="button"
                class="rounded-lg border border-border px-3 py-1.5 text-xs min-h-8 font-medium text-text-muted hover:text-ib-yellow hover:border-ib-yellow/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-yellow"
                (click)="openEditModal(patient)"
              >
                {{ 'common.edit' | transloco }}
              </button>
              <button
                type="button"
                class="rounded-lg border border-border px-3 py-1.5 text-xs min-h-8 font-medium text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-red"
                (click)="deletePatient(patient.id)"
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
          <app-icon name="users" size="48" class="text-text-muted/20 mx-auto mb-3" />
          <p class="text-sm text-text-muted">{{ 'medical.patient.empty' | transloco }}</p>
          <p class="text-xs text-text-muted mt-1">{{ 'medical.patient.emptyHint' | transloco }}</p>
        </div>
      }
    </section>

    <app-modal-dialog
      #createModal
      [title]="'medical.patient.modalCreateTitle' | transloco"
      (closed)="onModalClosed()"
    >
      @if (createModal.isOpen()) {
        <app-patient-form (submitted)="createPatient($event)" (cancelled)="createModal.close()" />
      }
    </app-modal-dialog>

    <app-modal-dialog
      #editModal
      [title]="'medical.patient.modalEditTitle' | transloco"
      (closed)="onModalClosed()"
    >
      @if (editModal.isOpen()) {
        <app-patient-form
          [initial]="selectedPatient()"
          (submitted)="updatePatient($event)"
          (cancelled)="editModal.close()"
        />
      }
    </app-modal-dialog>
  `,
})
export class Patients {
  private readonly patientGw = inject(PatientGateway);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(ConfirmService);
  private readonly _i18n = inject(TranslocoService);

  private readonly createModalRef = viewChild.required<ModalDialog>('createModal');
  private readonly editModalRef = viewChild.required<ModalDialog>('editModal');

  private readonly _refresh = signal(0);
  protected readonly patients = toSignal(
    toObservable(this._refresh).pipe(switchMap(() => this.patientGw.getAll())),
    { initialValue: [] },
  );

  protected readonly selectedPatient = signal<Patient | null>(null);

  protected openCreateModal() {
    this.createModalRef().open();
  }

  protected openEditModal(patient: Patient) {
    this.selectedPatient.set(patient);
    this.editModalRef().open();
  }

  protected onModalClosed() {
    this.selectedPatient.set(null);
  }

  protected async createPatient(data: Omit<Patient, 'id'>) {
    try {
      await lastValueFrom(this.patientGw.create(data));
      this.toaster.success('medical.patient.feedback.created');
      this.createModalRef().close();
      this._refresh.update((v) => v + 1);
    } catch {
      this.toaster.error('medical.patient.feedback.createFailed');
    }
  }

  protected async updatePatient(data: Omit<Patient, 'id'>) {
    const id = this.selectedPatient()?.id;
    if (!id) return;
    try {
      await lastValueFrom(this.patientGw.update(id, data));
      this.toaster.success('medical.patient.feedback.updated');
      this.editModalRef().close();
      this._refresh.update((v) => v + 1);
    } catch {
      this.toaster.error('medical.patient.feedback.updateFailed');
    }
  }

  protected async deletePatient(id: string) {
    if (!(await this.confirm.delete(this._i18n.translate('medical.patient.deleteEntityName'))))
      return;
    try {
      await lastValueFrom(this.patientGw.delete(id));
      this.toaster.success('medical.patient.feedback.deleted');
      this._refresh.update((v) => v + 1);
    } catch {
      this.toaster.error('medical.patient.feedback.deleteFailed');
    }
  }
}
