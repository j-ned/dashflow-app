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
import { Appointment, AppointmentStatus } from '../../domain/models/appointment.model';
import { Patient } from '../../domain/models/patient.model';
import { Practitioner } from '../../domain/models/practitioner.model';
import { AppointmentGateway } from '../../domain/gateways/appointment.gateway';
import { PatientGateway } from '../../domain/gateways/patient.gateway';
import { PractitionerGateway } from '../../domain/gateways/practitioner.gateway';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { AppointmentForm } from '../../components/appointment-form/appointment-form';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { Icon } from '@shared/components/icon/icon';
import { AppointmentActions } from '../../components/appointment-actions/appointment-actions';
import { AppointmentStatusBadge } from '../../components/appointment-status-badge/appointment-status-badge';
import { groupAppointments, localIsoDate } from '../../domain/appointment-groups';

@Component({
  selector: 'app-appointments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ModalDialog,
    AppointmentForm,
    Icon,
    TranslocoPipe,
    AppointmentActions,
    AppointmentStatusBadge,
  ],
  host: { class: 'block space-y-6' },
  template: `
    <header class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">
          {{ 'medical.appointment.title' | transloco }}
        </h2>
        <p class="mt-1 text-sm text-text-muted">{{ 'medical.appointment.subtitle' | transloco }}</p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg bg-ib-purple px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-purple/90 transition-colors shadow-sm"
        (click)="openCreateModal()"
      >
        <app-icon name="plus" size="14" /> {{ 'medical.appointment.create' | transloco }}
      </button>
    </header>

    <section
      [attr.aria-label]="'medical.appointment.listLabel' | transloco"
      class="rounded-xl border border-border bg-surface overflow-hidden"
    >
      <!-- Section header -->
      <div
        class="flex items-center justify-between px-5 py-3 bg-ib-blue/5 border-b border-border/50"
      >
        <div class="flex items-center gap-2">
          <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-blue/10">
            <app-icon name="calendar" size="14" class="text-ib-blue" />
          </div>
          <span class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{{
            'medical.appointment.groupLabel' | transloco
          }}</span>
        </div>
        <span class="text-[11px] font-mono font-semibold text-ib-blue">{{
          appointments().length
        }}</span>
      </div>
      @if (groups().length === 0) {
        <div class="px-4 py-16 text-center">
          <app-icon name="calendar" size="48" class="text-text-muted/20 mx-auto mb-3" />
          <p class="text-sm text-text-muted">{{ 'medical.appointment.empty' | transloco }}</p>
          <p class="text-xs text-text-muted mt-1">
            {{ 'medical.appointment.emptyHint' | transloco }}
          </p>
        </div>
      } @else {
        <!-- Tableau à partir de md ; en dessous, les mêmes lignes en cartes. -->
        <div class="hidden overflow-x-auto md:block">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border bg-hover/50">
                <th
                  class="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider"
                >
                  {{ 'medical.appointment.date' | transloco }}
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider"
                >
                  {{ 'medical.appointment.time' | transloco }}
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider"
                >
                  {{ 'medical.appointment.patient' | transloco }}
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider"
                >
                  {{ 'medical.appointment.practitioner' | transloco }}
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider"
                >
                  {{ 'medical.appointment.status' | transloco }}
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider"
                >
                  {{ 'medical.appointment.reason' | transloco }}
                </th>
                <th
                  class="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider"
                >
                  {{ 'medical.appointment.actions' | transloco }}
                </th>
              </tr>
            </thead>
            @for (group of groups(); track group.key) {
              <tbody [attr.data-testid]="'appointment-group-' + group.key">
                <tr class="border-b border-border/50 bg-hover/30">
                  <th
                    colspan="7"
                    scope="colgroup"
                    class="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted"
                  >
                    {{ 'medical.appointment.groups.' + group.key | transloco }}
                    <span class="ml-1 font-mono text-ib-blue">{{ group.rows.length }}</span>
                  </th>
                </tr>
                @for (row of group.rows; track row.appointment.id) {
                  <tr
                    class="border-b border-border/50 hover:bg-hover/30 transition-colors"
                    [class.opacity-70]="group.key === 'past'"
                  >
                    <td class="px-4 py-3 text-text-primary whitespace-nowrap">
                      {{ row.appointment.date | date: 'EEE d MMMM yyyy' }}
                    </td>
                    <td class="px-4 py-3 text-text-primary">{{ row.appointment.time }}</td>
                    <td class="px-4 py-3 text-text-primary">{{ row.patientName }}</td>
                    <td class="px-4 py-3 text-text-primary">{{ row.practitionerName }}</td>
                    <td class="px-4 py-3">
                      <app-appointment-status-badge [status]="row.appointment.status" />
                    </td>
                    <td class="px-4 py-3 text-text-muted text-xs max-w-48 truncate">
                      {{ row.appointment.reason ?? '-' }}
                    </td>
                    <td class="px-4 py-3">
                      <app-appointment-actions
                        [scheduled]="row.appointment.status === 'scheduled'"
                        (completed)="updateStatus(row.appointment, 'completed')"
                        (cancelled)="updateStatus(row.appointment, 'cancelled')"
                        (edited)="openEditModal(row.appointment)"
                        (deleted)="deleteAppointment(row.appointment.id)"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            }
          </table>
        </div>

        <div class="md:hidden">
          @for (group of groups(); track group.key) {
            <h3
              class="border-b border-border/50 bg-hover/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted"
            >
              {{ 'medical.appointment.groups.' + group.key | transloco }}
              <span class="ml-1 font-mono text-ib-blue">{{ group.rows.length }}</span>
            </h3>
            <ul>
              @for (row of group.rows; track row.appointment.id) {
                <li
                  class="flex flex-col gap-2 border-b border-border/50 px-4 py-3"
                  [class.opacity-70]="group.key === 'past'"
                >
                  <div class="flex items-start justify-between gap-3">
                    <p class="text-sm font-medium text-text-primary">
                      {{ row.appointment.date | date: 'EEE d MMMM' }} · {{ row.appointment.time }}
                    </p>
                    <app-appointment-status-badge [status]="row.appointment.status" />
                  </div>
                  <p class="text-sm text-text-primary">
                    {{ row.patientName }}
                    <span class="text-text-muted">· {{ row.practitionerName }}</span>
                  </p>
                  @if (row.appointment.reason) {
                    <p class="text-xs text-text-muted">{{ row.appointment.reason }}</p>
                  }
                  <app-appointment-actions
                    [scheduled]="row.appointment.status === 'scheduled'"
                    (completed)="updateStatus(row.appointment, 'completed')"
                    (cancelled)="updateStatus(row.appointment, 'cancelled')"
                    (edited)="openEditModal(row.appointment)"
                    (deleted)="deleteAppointment(row.appointment.id)"
                  />
                </li>
              }
            </ul>
          }
        </div>
      }
    </section>

    <app-modal-dialog
      #createModal
      [title]="'medical.appointment.modalCreateTitle' | transloco"
      (closed)="onModalClosed()"
    >
      @if (createModal.isOpen()) {
        <app-appointment-form
          [patients]="patients()"
          [practitioners]="practitioners()"
          (submitted)="createAppointment($event)"
          (cancelled)="createModal.close()"
        />
      }
    </app-modal-dialog>

    <app-modal-dialog
      #editModal
      [title]="'medical.appointment.modalEditTitle' | transloco"
      (closed)="onModalClosed()"
    >
      @if (editModal.isOpen()) {
        <app-appointment-form
          [initial]="selectedAppointment()"
          [patients]="patients()"
          [practitioners]="practitioners()"
          (submitted)="updateAppointment($event)"
          (cancelled)="editModal.close()"
        />
      }
    </app-modal-dialog>
  `,
})
export class Appointments {
  private readonly appointmentGw = inject(AppointmentGateway);
  private readonly patientGw = inject(PatientGateway);
  private readonly practitionerGw = inject(PractitionerGateway);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(ConfirmService);
  private readonly _i18n = inject(TranslocoService);

  private readonly createModalRef = viewChild.required<ModalDialog>('createModal');
  private readonly editModalRef = viewChild.required<ModalDialog>('editModal');

  private readonly _refresh = signal(0);
  protected readonly appointments = toSignal(
    toObservable(this._refresh).pipe(switchMap(() => this.appointmentGw.getAll())),
    { initialValue: [] },
  );

  private readonly _refreshPatients = signal(0);
  protected readonly patients = toSignal(
    toObservable(this._refreshPatients).pipe(switchMap(() => this.patientGw.getAll())),
    { initialValue: [] },
  );

  private readonly _refreshPractitioners = signal(0);
  protected readonly practitioners = toSignal(
    toObservable(this._refreshPractitioners).pipe(switchMap(() => this.practitionerGw.getAll())),
    { initialValue: [] },
  );

  private readonly patientsMap = computed(() => {
    const map = new Map<string, Patient>();
    for (const p of this.patients()) {
      map.set(p.id, p);
    }
    return map;
  });

  private readonly practitionersMap = computed(() => {
    const map = new Map<string, Practitioner>();
    for (const pr of this.practitioners()) {
      map.set(pr.id, pr);
    }
    return map;
  });

  // La ligne garde le rendez-vous tel quel : c'est lui qui repart au gateway (rechiffré en E2EE),
  // sans les libellés d'affichage.
  protected readonly groups = computed(() =>
    groupAppointments(this.appointments(), localIsoDate(new Date())).map((group) => ({
      key: group.key,
      rows: group.appointments.map((appointment) => ({
        appointment,
        patientName: this.patientName(appointment.patientId),
        practitionerName: this.practitionerName(appointment.practitionerId),
      })),
    })),
  );

  protected readonly selectedAppointment = signal<Appointment | null>(null);

  protected patientName(id: string): string {
    const p = this.patientsMap().get(id);
    return p ? `${p.firstName} ${p.lastName}` : id;
  }

  protected practitionerName(id: string): string {
    const pr = this.practitionersMap().get(id);
    return pr ? pr.name : id;
  }

  protected openCreateModal() {
    this.createModalRef().open();
  }

  protected openEditModal(appointment: Appointment) {
    this.selectedAppointment.set(appointment);
    this.editModalRef().open();
  }

  protected onModalClosed() {
    this.selectedAppointment.set(null);
  }

  protected async createAppointment(data: Omit<Appointment, 'id'>) {
    try {
      await lastValueFrom(this.appointmentGw.create(data));
      this.toaster.success('medical.appointment.feedback.created');
      this.createModalRef().close();
      this._refresh.update((v) => v + 1);
    } catch {
      this.toaster.error('medical.appointment.feedback.createFailed');
    }
  }

  protected async updateAppointment(data: Omit<Appointment, 'id'>) {
    const id = this.selectedAppointment()?.id;
    if (!id) return;
    try {
      await lastValueFrom(this.appointmentGw.update(id, data));
      this.toaster.success('medical.appointment.feedback.updated');
      this.editModalRef().close();
      this._refresh.update((v) => v + 1);
    } catch {
      this.toaster.error('medical.appointment.feedback.updateFailed');
    }
  }

  protected async updateStatus(appointment: Appointment, status: AppointmentStatus) {
    try {
      await lastValueFrom(this.appointmentGw.updateStatus(appointment, status));
      this.toaster.success('medical.appointment.feedback.statusUpdated');
      this._refresh.update((v) => v + 1);
    } catch {
      this.toaster.error('medical.appointment.feedback.statusFailed');
    }
  }

  protected async deleteAppointment(id: string) {
    if (!(await this.confirm.delete(this._i18n.translate('medical.appointment.deleteEntityName'))))
      return;
    try {
      await lastValueFrom(this.appointmentGw.delete(id));
      this.toaster.success('medical.appointment.feedback.deleted');
      this._refresh.update((v) => v + 1);
    } catch {
      this.toaster.error('medical.appointment.feedback.deleteFailed');
    }
  }
}
