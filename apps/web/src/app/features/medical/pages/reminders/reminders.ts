import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { lastValueFrom, switchMap } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Reminder } from '../../domain/models/reminder.model';

import { Appointment } from '../../domain/models/appointment.model';
import { Medication } from '../../domain/models/medication.model';
import { GetRemindersUseCase } from '../../domain/use-cases/get-reminders.use-case';
import { CreateReminderUseCase } from '../../domain/use-cases/create-reminder.use-case';
import { ToggleReminderUseCase } from '../../domain/use-cases/toggle-reminder.use-case';
import { DeleteReminderUseCase } from '../../domain/use-cases/delete-reminder.use-case';

import { GetMedicationsUseCase } from '../../domain/use-cases/get-medications.use-case';
import { GetAppointmentsUseCase } from '../../domain/use-cases/get-appointments.use-case';
import { GetPatientsUseCase } from '../../domain/use-cases/get-patients.use-case';
import { GetPractitionersUseCase } from '../../domain/use-cases/get-practitioners.use-case';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { ReminderForm } from '../../components/reminder-form/reminder-form';

import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { Icon } from '@shared/components/icon/icon';

@Component({
  selector: 'app-reminders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalDialog, ReminderForm, Icon, TranslocoPipe],
  host: { class: 'block space-y-6' },
  template: `
    <!-- Section 1: Alertes -->
    <header class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">{{ 'medical.reminder.title' | transloco }}</h2>
        <p class="mt-1 text-sm text-text-muted">{{ 'medical.reminder.subtitle' | transloco }}</p>
      </div>
      <button type="button"
              class="inline-flex items-center gap-1.5 rounded-lg bg-ib-purple px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-purple/90 transition-colors shadow-sm"
              (click)="openCreateReminderModal()">
        <app-icon name="plus" size="14" /> {{ 'medical.reminder.create' | transloco }}
      </button>
    </header>

    <section [attr.aria-label]="'medical.reminder.listLabel' | transloco" class="rounded-xl border border-border bg-surface overflow-hidden">
      <div class="flex items-center justify-between px-5 py-3 bg-ib-red/5 border-b border-border/50">
        <div class="flex items-center gap-2">
          <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-red/10">
            <app-icon name="bell" size="14" class="text-ib-red" />
          </div>
          <span class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{{ 'medical.reminder.groupLabel' | transloco }}</span>
        </div>
        <span class="text-[11px] font-mono font-semibold text-ib-red">{{ reminders().length }}</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="border-b border-border/50 bg-hover/30">
              <th class="px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">{{ 'medical.reminder.type' | transloco }}</th>
              <th class="px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">{{ 'medical.reminder.target' | transloco }}</th>
              <th class="px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">{{ 'medical.reminder.detail' | transloco }}</th>
              <th class="px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">{{ 'medical.reminder.email' | transloco }}</th>
              <th class="px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-center">{{ 'medical.reminder.enabled' | transloco }}</th>
              <th class="px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-center">{{ 'medical.reminder.calendar' | transloco }}</th>
              <th class="px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-right">{{ 'medical.reminder.actions' | transloco }}</th>
            </tr>
          </thead>
          <tbody>
            @for (reminder of reminders(); track reminder.id) {
              <tr class="border-b border-border/50 hover:bg-hover/50 transition-colors">
                <td class="px-5 py-3">
                  <span class="rounded-full px-2 py-0.5 text-xs font-medium"
                        [class.bg-ib-purple-10]="reminder.type === 'email'"
                        [class.text-ib-purple]="reminder.type === 'email'"
                        [class.bg-ib-cyan-10]="reminder.type === 'ical'"
                        [class.text-ib-cyan]="reminder.type === 'ical'">
                    {{ (reminder.type === 'email' ? 'medical.reminder.typeEmail' : 'medical.reminder.typeIcal') | transloco }}
                  </span>
                </td>
                <td class="px-5 py-3">
                  <span class="rounded-full px-2 py-0.5 text-xs font-medium"
                        [class.bg-ib-orange-10]="reminder.target === 'medication'"
                        [class.text-ib-orange]="reminder.target === 'medication'"
                        [class.bg-ib-blue-10]="reminder.target === 'appointment'"
                        [class.text-ib-blue]="reminder.target === 'appointment'">
                    {{ (reminder.target === 'medication' ? 'medical.reminder.targetMedication' : 'medical.reminder.targetAppointment') | transloco }}
                  </span>
                </td>
                <td class="px-5 py-3 text-xs text-text-muted max-w-48 truncate">
                  {{ reminderDetail(reminder) }}
                </td>
                <td class="px-5 py-3 text-sm text-text-primary">{{ reminder.recipientEmail }}</td>
                <td class="px-5 py-3 text-center">
                  <button type="button"
                          class="relative inline-flex h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-purple"
                          [class.bg-ib-purple]="reminder.enabled"
                          [class.bg-hover]="!reminder.enabled"
                          [attr.aria-checked]="reminder.enabled"
                          role="switch"
                          (click)="toggleReminder(reminder.id)">
                    <span class="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform mt-0.5"
                          [class.translate-x-4]="reminder.enabled"
                          [class.translate-x-0.5]="!reminder.enabled"></span>
                  </button>
                </td>
                <td class="px-5 py-3">
                  <div class="flex items-center justify-center gap-1">
                    <!-- Google Calendar -->
                    @if (googleCalendarUrl(reminder); as gUrl) {
                      <a [href]="gUrl" target="_blank" rel="noopener"
                         class="inline-flex items-center gap-1 rounded-lg border border-border min-h-8 px-3 py-1.5 text-xs font-medium text-text-muted hover:text-ib-blue hover:border-ib-blue/30 transition-colors"
                         [title]="'medical.reminder.googleTitle' | transloco">
                        <app-icon name="calendar" size="12" /> {{ 'medical.reminder.google' | transloco }}
                      </a>
                    }
                    <!-- .ics download (Apple/Thunderbird/Outlook) -->
                    <button type="button"
                            class="inline-flex items-center gap-1 rounded-lg border border-border min-h-8 px-3 py-1.5 text-xs font-medium text-text-muted hover:text-ib-cyan hover:border-ib-cyan/30 transition-colors"
                            [title]="'medical.reminder.icsTitle' | transloco"
                            (click)="downloadIcs(reminder)">
                      <app-icon name="download" size="12" /> .ics
                    </button>
                  </div>
                </td>
                <td class="px-5 py-3 text-right">
                  <button type="button"
                          class="rounded-lg border border-border px-3 py-1.5 text-xs min-h-8 font-medium text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-red"
                          (click)="deleteReminder(reminder.id)">
                    {{ 'medical.reminder.delete' | transloco }}
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="px-5 py-16 text-center">
                  <app-icon name="bell" size="48" class="text-text-muted/20 mx-auto mb-3" />
                  <p class="text-sm text-text-muted">{{ 'medical.reminder.empty' | transloco }}</p>
                  <p class="text-xs text-text-muted mt-1">{{ 'medical.reminder.emptyHint' | transloco }}</p>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    <app-modal-dialog #createReminderModal [title]="'medical.reminder.modalCreateTitle' | transloco" (closed)="onReminderModalClosed()">
      @if (createReminderModal.isOpen()) {
        <app-reminder-form [medications]="medications()" [appointments]="appointments()" (submitted)="createReminder($event)" (cancelled)="createReminderModal.close()" />
      }
    </app-modal-dialog>
  `,
})
export class Reminders {
  private readonly getReminders = inject(GetRemindersUseCase);
  private readonly createReminderUC = inject(CreateReminderUseCase);
  private readonly toggleReminderUC = inject(ToggleReminderUseCase);
  private readonly deleteReminderUC = inject(DeleteReminderUseCase);

  private readonly getMedicationsUC = inject(GetMedicationsUseCase);
  private readonly getAppointmentsUC = inject(GetAppointmentsUseCase);
  private readonly getPatientsUC = inject(GetPatientsUseCase);
  private readonly getPractitionersUC = inject(GetPractitionersUseCase);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(ConfirmService);
  private readonly _i18n = inject(TranslocoService);

  private readonly createReminderModalRef = viewChild.required<ModalDialog>('createReminderModal');
  private readonly _refreshReminders = signal(0);
  protected readonly reminders = toSignal(
    toObservable(this._refreshReminders).pipe(switchMap(() => this.getReminders.execute())),
    { initialValue: [] },
  );

  protected readonly medications = toSignal(this.getMedicationsUC.execute(), { initialValue: [] });
  protected readonly appointments = toSignal(this.getAppointmentsUC.execute(), { initialValue: [] });
  private readonly patients = toSignal(this.getPatientsUC.execute(), { initialValue: [] });
  private readonly practitioners = toSignal(this.getPractitionersUC.execute(), { initialValue: [] });

  private readonly appointmentMap = computed(() => {
    const map = new Map<string, Appointment>();
    for (const a of this.appointments()) map.set(a.id, a);
    return map;
  });

  private readonly medicationMap = computed(() => {
    const map = new Map<string, Medication>();
    for (const m of this.medications()) map.set(m.id, m);
    return map;
  });

  private readonly patientMap = computed(() => {
    const map = new Map<string, string>();
    for (const p of this.patients()) map.set(p.id, `${p.firstName} ${p.lastName}`);
    return map;
  });

  private readonly practitionerMap = computed(() => {
    const map = new Map<string, string>();
    for (const pr of this.practitioners()) map.set(pr.id, pr.name);
    return map;
  });

  // ── Calendar helpers ──

  protected reminderDetail(reminder: Reminder): string {
    if (reminder.target === 'appointment' && reminder.appointmentId) {
      const appt = this.appointmentMap().get(reminder.appointmentId);
      if (appt) {
        const patient = this.patientMap().get(appt.patientId) ?? '';
        const practitioner = this.practitionerMap().get(appt.practitionerId) ?? '';
        return `${appt.date} ${appt.time} — ${patient} / ${practitioner}`;
      }
    }
    if (reminder.target === 'medication' && reminder.medicationId) {
      const med = this.medicationMap().get(reminder.medicationId);
      if (med) {
        const patient = this.patientMap().get(med.patientId) ?? '';
        return `${med.name} (${med.dosage}) — ${patient}`;
      }
    }
    return '-';
  }

  protected googleCalendarUrl(reminder: Reminder): string | null {
    if (reminder.target === 'appointment' && reminder.appointmentId) {
      const appt = this.appointmentMap().get(reminder.appointmentId);
      if (!appt) return null;
      const patient = this.patientMap().get(appt.patientId) ?? this._i18n.translate('medical.reminder.fallbackPatient');
      const practitioner = this.practitionerMap().get(appt.practitionerId) ?? '';
      const title = this._i18n.translate('medical.reminder.appointmentTitle', { patient, practitioner });
      const start = this.toGoogleDate(appt.date, appt.time);
      const end = this.toGoogleDate(appt.date, appt.time, 60);
      const details = appt.reason ? this._i18n.translate('medical.reminder.appointmentReason', { reason: appt.reason }) : '';
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${encodeURIComponent(details)}`;
    }
    if (reminder.target === 'medication' && reminder.medicationId) {
      const med = this.medicationMap().get(reminder.medicationId);
      if (!med) return null;
      const patient = this.patientMap().get(med.patientId) ?? this._i18n.translate('medical.reminder.fallbackPatient');
      const title = this._i18n.translate('medical.reminder.medicationTitle', { name: med.name, patient });
      const today = new Date();
      const start = this.formatGoogleDateOnly(today);
      const details = this._i18n.translate('medical.reminder.medicationDescription', { dosage: med.dosage, patient });
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${start}&details=${encodeURIComponent(details)}&recur=RRULE:FREQ=DAILY`;
    }
    return null;
  }

  protected downloadIcs(reminder: Reminder) {
    let icsContent: string | null = null;

    if (reminder.target === 'appointment' && reminder.appointmentId) {
      const appt = this.appointmentMap().get(reminder.appointmentId);
      if (!appt) return;
      const patient = this.patientMap().get(appt.patientId) ?? this._i18n.translate('medical.reminder.fallbackPatient');
      const practitioner = this.practitionerMap().get(appt.practitionerId) ?? '';
      const title = this._i18n.translate('medical.reminder.appointmentTitle', { patient, practitioner });
      const dtStart = this.toIcsDateTime(appt.date, appt.time);
      const dtEnd = this.toIcsDateTime(appt.date, appt.time, 60);
      const description = appt.reason ? this._i18n.translate('medical.reminder.appointmentReason', { reason: appt.reason }) : '';
      const alarmDescription = this._i18n.translate('medical.reminder.alarmAppointment');

      icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//DashFlow//Medical//FR',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${reminder.id}@dashflow`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${this.escapeIcs(title)}`,
        description ? `DESCRIPTION:${this.escapeIcs(description)}` : '',
        'BEGIN:VALARM',
        'TRIGGER:-PT30M',
        'ACTION:DISPLAY',
        `DESCRIPTION:${this.escapeIcs(alarmDescription)}`,
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR',
      ].filter(Boolean).join('\r\n');
    }

    if (reminder.target === 'medication' && reminder.medicationId) {
      const med = this.medicationMap().get(reminder.medicationId);
      if (!med) return;
      const patient = this.patientMap().get(med.patientId) ?? this._i18n.translate('medical.reminder.fallbackPatient');
      const title = this._i18n.translate('medical.reminder.medicationTitle', { name: med.name, patient });
      const description = this._i18n.translate('medical.reminder.medicationDescription', { dosage: med.dosage, patient }).replace(/\n/g, '\\n');
      const alarmDescription = this._i18n.translate('medical.reminder.alarmMedication');
      const dtStart = this.toIcsDateOnly(new Date());

      const rruleParts = ['FREQ=DAILY'];
      if (med.skipDays.length > 0) {
        const icsSkipDays = med.skipDays.map(d => ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][d]).filter(Boolean);
        if (icsSkipDays.length > 0) {
          rruleParts.push(`BYDAY=${this.allDaysExcept(med.skipDays).map(d => ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][d]).join(',')}`);
        }
      }

      icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//DashFlow//Medical//FR',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${reminder.id}@dashflow`,
        `DTSTART;VALUE=DATE:${dtStart}`,
        `RRULE:${rruleParts.join(';')}`,
        `SUMMARY:${this.escapeIcs(title)}`,
        `DESCRIPTION:${description}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT15M',
        'ACTION:DISPLAY',
        `DESCRIPTION:${this.escapeIcs(alarmDescription)}`,
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');
    }

    if (!icsContent) return;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashflow-alerte-${reminder.id.slice(0, 8)}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    this.toaster.success('medical.reminder.feedback.icsDownloaded');
  }

  // ── Date formatting helpers ──

  private toGoogleDate(date: string, time: string, addMinutes = 0): string {
    const d = new Date(`${date}T${time}`);
    if (addMinutes) d.setMinutes(d.getMinutes() + addMinutes);
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  private formatGoogleDateOnly(d: Date): string {
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  }

  private toIcsDateTime(date: string, time: string, addMinutes = 0): string {
    const d = new Date(`${date}T${time}`);
    if (addMinutes) d.setMinutes(d.getMinutes() + addMinutes);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  }

  private toIcsDateOnly(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  }

  private escapeIcs(s: string): string {
    return s.replace(/[\\;,]/g, c => `\\${c}`).replace(/\n/g, '\\n');
  }

  private allDaysExcept(skipDays: number[]): number[] {
    return [0, 1, 2, 3, 4, 5, 6].filter(d => !skipDays.includes(d));
  }

  // ── Reminder CRUD ──

  protected openCreateReminderModal() {
    this.createReminderModalRef().open();
  }

  protected onReminderModalClosed() {
    // no selection to clear for reminders
  }

  protected async createReminder(data: Omit<Reminder, 'id'>) {
    try {
      await lastValueFrom(this.createReminderUC.execute(data));
      this.toaster.success('medical.reminder.feedback.created');
      this.createReminderModalRef().close();
      this._refreshReminders.update(v => v + 1);
    } catch {
      this.toaster.error('medical.reminder.feedback.createFailed');
    }
  }

  protected async toggleReminder(id: string) {
    try {
      await lastValueFrom(this.toggleReminderUC.execute(id));
      this.toaster.success('medical.reminder.feedback.updated');
      this._refreshReminders.update(v => v + 1);
    } catch {
      this.toaster.error('medical.reminder.feedback.updateFailed');
    }
  }

  protected async deleteReminder(id: string) {
    if (!await this.confirm.delete(this._i18n.translate('medical.reminder.deleteEntityName'))) return;
    try {
      await lastValueFrom(this.deleteReminderUC.execute(id));
      this.toaster.success('medical.reminder.feedback.deleted');
      this._refreshReminders.update(v => v + 1);
    } catch {
      this.toaster.error('medical.reminder.feedback.deleteFailed');
    }
  }

}
