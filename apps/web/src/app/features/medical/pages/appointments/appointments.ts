import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { lastValueFrom, switchMap } from 'rxjs';
import { Appointment, AppointmentStatus } from '../../domain/models/appointment.model';
import { Patient } from '../../domain/models/patient.model';
import { Practitioner } from '../../domain/models/practitioner.model';
import { GetAppointmentsUseCase } from '../../domain/use-cases/get-appointments.use-case';
import { CreateAppointmentUseCase } from '../../domain/use-cases/create-appointment.use-case';
import { UpdateAppointmentUseCase } from '../../domain/use-cases/update-appointment.use-case';
import { UpdateAppointmentStatusUseCase } from '../../domain/use-cases/update-appointment-status.use-case';
import { DeleteAppointmentUseCase } from '../../domain/use-cases/delete-appointment.use-case';
import { GetPatientsUseCase } from '../../domain/use-cases/get-patients.use-case';
import { GetPractitionersUseCase } from '../../domain/use-cases/get-practitioners.use-case';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { AppointmentForm } from '../../components/appointment-form/appointment-form';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { Icon } from '@shared/components/icon/icon';

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Planifié',
  completed: 'Terminé',
  cancelled: 'Annulé',
  no_show: 'Absent',
};

@Component({
  selector: 'app-appointments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ModalDialog, AppointmentForm, Icon],
  host: { class: 'block space-y-6' },
  template: `
    <header class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">Rendez-vous</h2>
        <p class="mt-1 text-sm text-text-muted">Gérez vos rendez-vous médicaux</p>
      </div>
      <button type="button"
              class="inline-flex items-center gap-1.5 rounded-lg bg-ib-purple px-4 py-2 text-sm font-medium text-white hover:bg-ib-purple/90 transition-colors shadow-sm"
              (click)="openCreateModal()">
        <app-icon name="plus" size="14" /> Nouveau rendez-vous
      </button>
    </header>

    <section aria-label="Liste des rendez-vous" class="rounded-xl border border-border bg-surface overflow-hidden">
      <!-- Section header -->
      <div class="flex items-center justify-between px-5 py-3 bg-ib-blue/5 border-b border-border/50">
        <div class="flex items-center gap-2">
          <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-blue/10">
            <app-icon name="calendar" size="14" class="text-ib-blue" />
          </div>
          <span class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Rendez-vous</span>
        </div>
        <span class="text-[11px] font-mono font-semibold text-ib-blue">{{ appointments().length }}</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border bg-hover/50">
              <th class="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Date</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Heure</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Patient</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Praticien</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Statut</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Motif</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (appt of appointments(); track appt.id) {
              <tr class="border-b border-border/50 hover:bg-hover/30 transition-colors">
                <td class="px-4 py-3 text-text-primary">{{ appt.date | date:'d MMMM yyyy' }}</td>
                <td class="px-4 py-3 text-text-primary">{{ appt.time }}</td>
                <td class="px-4 py-3 text-text-primary">{{ patientName(appt.patientId) }}</td>
                <td class="px-4 py-3 text-text-primary">{{ practitionerName(appt.practitionerId) }}</td>
                <td class="px-4 py-3">
                  <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                        [class.bg-ib-blue-15]="appt.status === 'scheduled'"
                        [class.text-ib-blue]="appt.status === 'scheduled'"
                        [class.bg-ib-green-15]="appt.status === 'completed'"
                        [class.text-ib-green]="appt.status === 'completed'"
                        [class.bg-hover]="appt.status === 'cancelled'"
                        [class.text-text-muted]="appt.status === 'cancelled'"
                        [class.bg-ib-red-15]="appt.status === 'no_show'"
                        [class.text-ib-red]="appt.status === 'no_show'">
                    {{ statusLabel(appt.status) }}
                  </span>
                </td>
                <td class="px-4 py-3 text-text-muted text-xs max-w-48 truncate">{{ appt.reason ?? '-' }}</td>
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-1">
                    @if (appt.status === 'scheduled') {
                      <button type="button"
                              class="rounded-lg border border-border px-2 py-1 text-xs font-medium text-text-muted hover:text-ib-green hover:border-ib-green/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-green"
                              (click)="updateStatus(appt.id, 'completed')">
                        Compléter
                      </button>
                      <button type="button"
                              class="rounded-lg border border-border px-2 py-1 text-xs font-medium text-text-muted hover:text-ib-yellow hover:border-ib-yellow/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-yellow"
                              (click)="updateStatus(appt.id, 'cancelled')">
                        Annuler
                      </button>
                    }
                    <button type="button"
                            class="rounded-lg border border-border px-2 py-1 text-xs font-medium text-text-muted hover:text-ib-blue hover:border-ib-blue/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                            (click)="openEditModal(appt)">
                      Modifier
                    </button>
                    <button type="button"
                            class="rounded-lg border border-border px-2 py-1 text-xs font-medium text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-red"
                            (click)="deleteAppointment(appt.id)">
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="px-4 py-16 text-center">
                  <app-icon name="calendar" size="48" class="text-text-muted/20 mx-auto mb-3" />
                  <p class="text-sm text-text-muted">Aucun rendez-vous</p>
                  <p class="text-xs text-text-muted mt-1">Planifiez votre premier rendez-vous</p>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    <app-modal-dialog #createModal title="Nouveau rendez-vous" (closed)="onModalClosed()">
      <app-appointment-form
        [patients]="patients()"
        [practitioners]="practitioners()"
        (submitted)="createAppointment($event)"
        (cancelled)="createModal.close()" />
    </app-modal-dialog>

    <app-modal-dialog #editModal title="Modifier le rendez-vous" (closed)="onModalClosed()">
      <app-appointment-form
        [initial]="selectedAppointment()"
        [patients]="patients()"
        [practitioners]="practitioners()"
        (submitted)="updateAppointment($event)"
        (cancelled)="editModal.close()" />
    </app-modal-dialog>
  `,
})
export class Appointments {
  private readonly getAppointments = inject(GetAppointmentsUseCase);
  private readonly createAppointmentUC = inject(CreateAppointmentUseCase);
  private readonly updateAppointmentUC = inject(UpdateAppointmentUseCase);
  private readonly updateAppointmentStatusUC = inject(UpdateAppointmentStatusUseCase);
  private readonly deleteAppointmentUC = inject(DeleteAppointmentUseCase);
  private readonly getPatientsUC = inject(GetPatientsUseCase);
  private readonly getPractitionersUC = inject(GetPractitionersUseCase);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(ConfirmService);

  private readonly createModalRef = viewChild.required<ModalDialog>('createModal');
  private readonly editModalRef = viewChild.required<ModalDialog>('editModal');

  private readonly _refresh = signal(0);
  protected readonly appointments = toSignal(
    toObservable(this._refresh).pipe(switchMap(() => this.getAppointments.execute())),
    { initialValue: [] },
  );

  private readonly _refreshPatients = signal(0);
  protected readonly patients = toSignal(
    toObservable(this._refreshPatients).pipe(switchMap(() => this.getPatientsUC.execute())),
    { initialValue: [] },
  );

  private readonly _refreshPractitioners = signal(0);
  protected readonly practitioners = toSignal(
    toObservable(this._refreshPractitioners).pipe(switchMap(() => this.getPractitionersUC.execute())),
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

  protected readonly selectedAppointment = signal<Appointment | null>(null);

  protected patientName(id: string): string {
    const p = this.patientsMap().get(id);
    return p ? `${p.firstName} ${p.lastName}` : id;
  }

  protected practitionerName(id: string): string {
    const pr = this.practitionersMap().get(id);
    return pr ? pr.name : id;
  }

  protected statusLabel(status: AppointmentStatus): string {
    return STATUS_LABELS[status];
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
      await lastValueFrom(this.createAppointmentUC.execute(data));
      this.toaster.success('Rendez-vous créé');
      this.createModalRef().close();
      this._refresh.update(v => v + 1);
    } catch {
      this.toaster.error('Erreur lors de la création');
    }
  }

  protected async updateAppointment(data: Omit<Appointment, 'id'>) {
    const id = this.selectedAppointment()?.id;
    if (!id) return;
    try {
      await lastValueFrom(this.updateAppointmentUC.execute(id, data));
      this.toaster.success('Rendez-vous modifié');
      this.editModalRef().close();
      this._refresh.update(v => v + 1);
    } catch {
      this.toaster.error('Erreur lors de la modification');
    }
  }

  protected async updateStatus(id: string, status: AppointmentStatus) {
    try {
      await lastValueFrom(this.updateAppointmentStatusUC.execute(id, status));
      this.toaster.success('Statut du rendez-vous mis à jour');
      this._refresh.update(v => v + 1);
    } catch {
      this.toaster.error('Erreur lors du changement de statut');
    }
  }

  protected async deleteAppointment(id: string) {
    if (!await this.confirm.delete('ce rendez-vous')) return;
    try {
      await lastValueFrom(this.deleteAppointmentUC.execute(id));
      this.toaster.success('Rendez-vous supprimé');
      this._refresh.update(v => v + 1);
    } catch {
      this.toaster.error('Erreur lors de la suppression');
    }
  }
}
