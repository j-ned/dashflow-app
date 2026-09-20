import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  LOCALE_ID,
  signal,
  viewChild,
} from '@angular/core';
import { formatDate } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { lastValueFrom, switchMap } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Reminder } from '../../domain/models/reminder.model';

import { Appointment } from '../../domain/models/appointment.model';
import { Medication } from '../../domain/models/medication.model';
import { ReminderGateway } from '../../domain/gateways/reminder.gateway';
import { MedicationGateway } from '../../domain/gateways/medication.gateway';
import { AppointmentGateway } from '../../domain/gateways/appointment.gateway';
import { PatientGateway } from '../../domain/gateways/patient.gateway';
import { PractitionerGateway } from '../../domain/gateways/practitioner.gateway';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { ReminderForm } from '../../components/reminder-form/reminder-form';

import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { Icon } from '@shared/components/icon/icon';
import { ToggleSwitch } from '@shared/components/toggle-switch/toggle-switch';
import { ReminderTargetBadge } from '../../components/reminder-target-badge/reminder-target-badge';
import { ReminderCalendarLinks } from '../../components/reminder-calendar-links/reminder-calendar-links';
import { ReminderDeleteButton } from '../../components/reminder-delete-button/reminder-delete-button';
import {
  allDaysExcept,
  escapeIcs,
  formatGoogleDateOnly,
  toGoogleDate,
  toIcsDateOnly,
  toIcsDateTime,
} from '../../domain/calendar-format';

const ICS_WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

@Component({
  selector: 'app-reminders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalDialog,
    ReminderForm,
    Icon,
    TranslocoPipe,
    ToggleSwitch,
    ReminderTargetBadge,
    ReminderCalendarLinks,
    ReminderDeleteButton,
  ],
  host: { class: 'block space-y-6' },
  template: `
    <!-- Section 1: Alertes -->
    <header class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">
          {{ 'medical.reminder.title' | transloco }}
        </h2>
        <p class="mt-1 text-sm text-text-muted">{{ 'medical.reminder.subtitle' | transloco }}</p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg bg-ib-purple px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-purple/90 transition-colors shadow-sm"
        (click)="openCreateReminderModal()"
      >
        <app-icon name="plus" size="14" /> {{ 'medical.reminder.create' | transloco }}
      </button>
    </header>

    <section
      [attr.aria-label]="'medical.reminder.listLabel' | transloco"
      class="rounded-xl border border-border bg-surface overflow-hidden"
    >
      <div
        class="flex items-center justify-between px-5 py-3 bg-ib-red/5 border-b border-border/50"
      >
        <div class="flex items-center gap-2">
          <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-ib-red/10">
            <app-icon name="bell" size="14" class="text-ib-red" />
          </div>
          <span class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{{
            'medical.reminder.groupLabel' | transloco
          }}</span>
        </div>
        <span class="text-[11px] font-mono font-semibold text-ib-red">{{
          reminders().length
        }}</span>
      </div>
      <div class="hidden md:block overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="border-b border-border/50 bg-hover/30">
              <th class="px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                {{ 'medical.reminder.target' | transloco }}
              </th>
              <th class="px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                {{ 'medical.reminder.detail' | transloco }}
              </th>
              <th
                class="px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-center"
              >
                {{ 'medical.reminder.enabled' | transloco }}
              </th>
              <th
                class="px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-center"
              >
                {{ 'medical.reminder.calendar' | transloco }}
              </th>
              <th
                class="px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-right"
              >
                {{ 'medical.reminder.actions' | transloco }}
              </th>
            </tr>
          </thead>
          <tbody>
            @for (reminder of reminderRows(); track reminder.id) {
              <tr class="border-b border-border/50 hover:bg-hover/50 transition-colors">
                <td class="px-5 py-3">
                  <app-reminder-target-badge [target]="reminder.target" />
                </td>
                <td class="px-5 py-3 text-xs text-text-muted max-w-48 truncate">
                  {{ reminder.detail }}
                </td>
                <td class="px-5 py-3 text-center">
                  <app-toggle-switch
                    [checked]="reminder.enabled"
                    [label]="'medical.reminder.toggleAria' | transloco: { detail: reminder.detail }"
                    (toggled)="toggleReminder(reminder.id)"
                  />
                </td>
                <td class="px-5 py-3">
                  <app-reminder-calendar-links
                    [googleUrl]="reminder.googleUrl"
                    (icsRequested)="downloadIcs(reminder)"
                  />
                </td>
                <td class="px-5 py-3 text-right">
                  <app-reminder-delete-button (deleteRequested)="deleteReminder(reminder.id)" />
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="px-5 py-16 text-center">
                  <app-icon name="bell" size="48" class="text-text-muted/20 mx-auto mb-3" />
                  <p class="text-sm text-text-muted">{{ 'medical.reminder.empty' | transloco }}</p>
                  <p class="text-xs text-text-muted mt-1">
                    {{ 'medical.reminder.emptyHint' | transloco }}
                  </p>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Sous md : une carte par alerte, le tableau à 5 colonnes ne tient pas sur un téléphone -->
      <ul class="md:hidden divide-y divide-border/50">
        @for (reminder of reminderRows(); track reminder.id) {
          <li class="flex flex-col gap-3 px-4 py-4">
            <div class="flex items-center justify-between gap-2">
              <div class="flex flex-wrap items-center gap-1.5">
                <app-reminder-target-badge [target]="reminder.target" />
              </div>
              <app-toggle-switch
                [checked]="reminder.enabled"
                [label]="'medical.reminder.toggleAria' | transloco: { detail: reminder.detail }"
                (toggled)="toggleReminder(reminder.id)"
              />
            </div>
            <div class="min-w-0">
              <p class="text-sm text-text-primary break-words">{{ reminder.detail }}</p>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <app-reminder-calendar-links
                [googleUrl]="reminder.googleUrl"
                (icsRequested)="downloadIcs(reminder)"
              />
              <app-reminder-delete-button (deleteRequested)="deleteReminder(reminder.id)" />
            </div>
          </li>
        } @empty {
          <li class="px-5 py-16 text-center">
            <app-icon name="bell" size="48" class="text-text-muted/20 mx-auto mb-3" />
            <p class="text-sm text-text-muted">{{ 'medical.reminder.empty' | transloco }}</p>
            <p class="text-xs text-text-muted mt-1">
              {{ 'medical.reminder.emptyHint' | transloco }}
            </p>
          </li>
        }
      </ul>
    </section>

    <app-modal-dialog
      #createReminderModal
      [title]="'medical.reminder.modalCreateTitle' | transloco"
      (closed)="onReminderModalClosed()"
    >
      @if (createReminderModal.isOpen()) {
        <app-reminder-form
          [medications]="medications()"
          [appointments]="appointments()"
          (submitted)="createReminder($event)"
          (cancelled)="createReminderModal.close()"
        />
      }
    </app-modal-dialog>
  `,
})
export class Reminders {
  private readonly reminderGw = inject(ReminderGateway);
  private readonly medicationGw = inject(MedicationGateway);
  private readonly appointmentGw = inject(AppointmentGateway);
  private readonly patientGw = inject(PatientGateway);
  private readonly practitionerGw = inject(PractitionerGateway);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(ConfirmService);
  private readonly _i18n = inject(TranslocoService);
  private readonly _locale = inject(LOCALE_ID);

  private readonly createReminderModalRef = viewChild.required<ModalDialog>('createReminderModal');
  private readonly _refreshReminders = signal(0);
  protected readonly reminders = toSignal(
    toObservable(this._refreshReminders).pipe(switchMap(() => this.reminderGw.getAll())),
    { initialValue: [] },
  );

  protected readonly medications = toSignal(this.medicationGw.getAll(), { initialValue: [] });
  protected readonly appointments = toSignal(this.appointmentGw.getAll(), { initialValue: [] });
  private readonly patients = toSignal(this.patientGw.getAll(), { initialValue: [] });
  private readonly practitioners = toSignal(this.practitionerGw.getAll(), { initialValue: [] });

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

  protected readonly reminderRows = computed(() =>
    this.reminders().map((reminder) => ({
      ...reminder,
      detail: this.reminderDetail(reminder),
      googleUrl: this.googleCalendarUrl(reminder),
    })),
  );

  // ── Calendar helpers ──

  private reminderDetail(reminder: Reminder): string {
    if (reminder.target === 'appointment' && reminder.appointmentId) {
      const appt = this.appointmentMap().get(reminder.appointmentId);
      if (appt) {
        const patient = this.patientMap().get(appt.patientId) ?? '';
        const practitioner = this.practitionerMap().get(appt.practitionerId) ?? '';
        const day = formatDate(appt.date, 'd MMM y', this._locale);
        return `${day} · ${appt.time} : ${patient} / ${practitioner}`;
      }
    }
    if (reminder.target === 'medication' && reminder.medicationId) {
      const med = this.medicationMap().get(reminder.medicationId);
      if (med) {
        const patient = this.patientMap().get(med.patientId) ?? '';
        return `${med.name} (${med.dosage}) : ${patient}`;
      }
    }
    return '-';
  }

  private googleCalendarUrl(reminder: Reminder): string | null {
    if (reminder.target === 'appointment' && reminder.appointmentId) {
      const appt = this.appointmentMap().get(reminder.appointmentId);
      if (!appt) return null;
      const patient =
        this.patientMap().get(appt.patientId) ??
        this._i18n.translate('medical.reminder.fallbackPatient');
      const practitioner = this.practitionerMap().get(appt.practitionerId) ?? '';
      const title = this._i18n.translate('medical.reminder.appointmentTitle', {
        patient,
        practitioner,
      });
      const start = toGoogleDate(appt.date, appt.time);
      const end = toGoogleDate(appt.date, appt.time, 60);
      const details = appt.reason
        ? this._i18n.translate('medical.reminder.appointmentReason', { reason: appt.reason })
        : '';
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${encodeURIComponent(details)}`;
    }
    if (reminder.target === 'medication' && reminder.medicationId) {
      const med = this.medicationMap().get(reminder.medicationId);
      if (!med) return null;
      const patient =
        this.patientMap().get(med.patientId) ??
        this._i18n.translate('medical.reminder.fallbackPatient');
      const title = this._i18n.translate('medical.reminder.medicationTitle', {
        name: med.name,
        patient,
      });
      const today = new Date();
      const start = formatGoogleDateOnly(today);
      const details = this._i18n.translate('medical.reminder.medicationDescription', {
        dosage: med.dosage,
        patient,
      });
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${start}&details=${encodeURIComponent(details)}&recur=RRULE:FREQ=DAILY`;
    }
    return null;
  }

  protected downloadIcs(reminder: Reminder) {
    let icsContent: string | null = null;

    if (reminder.target === 'appointment' && reminder.appointmentId) {
      const appt = this.appointmentMap().get(reminder.appointmentId);
      if (!appt) return;
      const patient =
        this.patientMap().get(appt.patientId) ??
        this._i18n.translate('medical.reminder.fallbackPatient');
      const practitioner = this.practitionerMap().get(appt.practitionerId) ?? '';
      const title = this._i18n.translate('medical.reminder.appointmentTitle', {
        patient,
        practitioner,
      });
      const dtStart = toIcsDateTime(appt.date, appt.time);
      const dtEnd = toIcsDateTime(appt.date, appt.time, 60);
      const description = appt.reason
        ? this._i18n.translate('medical.reminder.appointmentReason', { reason: appt.reason })
        : '';
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
        `SUMMARY:${escapeIcs(title)}`,
        description ? `DESCRIPTION:${escapeIcs(description)}` : '',
        'BEGIN:VALARM',
        'TRIGGER:-PT30M',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeIcs(alarmDescription)}`,
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR',
      ]
        .filter(Boolean)
        .join('\r\n');
    }

    if (reminder.target === 'medication' && reminder.medicationId) {
      const med = this.medicationMap().get(reminder.medicationId);
      if (!med) return;
      const patient =
        this.patientMap().get(med.patientId) ??
        this._i18n.translate('medical.reminder.fallbackPatient');
      const title = this._i18n.translate('medical.reminder.medicationTitle', {
        name: med.name,
        patient,
      });
      const description = this._i18n
        .translate('medical.reminder.medicationDescription', { dosage: med.dosage, patient })
        .replace(/\n/g, '\\n');
      const alarmDescription = this._i18n.translate('medical.reminder.alarmMedication');
      const dtStart = toIcsDateOnly(new Date());

      const rruleParts = ['FREQ=DAILY'];
      if (med.skipDays.length > 0) {
        const hasValidSkipDay = med.skipDays.some((d) => ICS_WEEKDAYS[d]);
        if (hasValidSkipDay) {
          const byDays = allDaysExcept(med.skipDays)
            .map((d) => ICS_WEEKDAYS[d])
            .filter(Boolean);
          rruleParts.push(`BYDAY=${byDays.join(',')}`);
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
        `SUMMARY:${escapeIcs(title)}`,
        `DESCRIPTION:${description}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT15M',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeIcs(alarmDescription)}`,
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

  // ── Reminder CRUD ──

  protected openCreateReminderModal() {
    this.createReminderModalRef().open();
  }

  protected onReminderModalClosed() {
    // no selection to clear for reminders
  }

  protected async createReminder(data: Omit<Reminder, 'id'>) {
    try {
      await lastValueFrom(this.reminderGw.create(data));
      this.toaster.success('medical.reminder.feedback.created');
      this.createReminderModalRef().close();
      this._refreshReminders.update((v) => v + 1);
    } catch {
      this.toaster.error('medical.reminder.feedback.createFailed');
    }
  }

  protected async toggleReminder(id: string) {
    try {
      await lastValueFrom(this.reminderGw.toggle(id));
      this.toaster.success('medical.reminder.feedback.updated');
      this._refreshReminders.update((v) => v + 1);
    } catch {
      this.toaster.error('medical.reminder.feedback.updateFailed');
    }
  }

  protected async deleteReminder(id: string) {
    if (!(await this.confirm.delete(this._i18n.translate('medical.reminder.deleteEntityName'))))
      return;
    try {
      await lastValueFrom(this.reminderGw.delete(id));
      this.toaster.success('medical.reminder.feedback.deleted');
      this._refreshReminders.update((v) => v + 1);
    } catch {
      this.toaster.error('medical.reminder.feedback.deleteFailed');
    }
  }
}
