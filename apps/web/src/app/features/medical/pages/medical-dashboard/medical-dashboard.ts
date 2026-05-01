import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { lastValueFrom } from 'rxjs';
import { Patient } from '../../domain/models/patient.model';
import { Appointment } from '../../domain/models/appointment.model';
import { Prescription } from '../../domain/models/prescription.model';
import { MedicationWithStock } from '../../domain/models/medication.model';
import { GetPatientsUseCase } from '../../domain/use-cases/get-patients.use-case';
import { GetPractitionersUseCase } from '../../domain/use-cases/get-practitioners.use-case';
import { GetAppointmentsUseCase } from '../../domain/use-cases/get-appointments.use-case';
import { GetPrescriptionsUseCase } from '../../domain/use-cases/get-prescriptions.use-case';
import { PrescriptionGateway } from '../../domain/gateways/prescription.gateway';
import { GetMedicationsUseCase } from '../../domain/use-cases/get-medications.use-case';
import { computeMedicationStock } from '../../domain/medication-calculator';
import { MedicationStockBar } from '../../components/medication-stock-bar/medication-stock-bar';
import { Icon } from '@shared/components/icon/icon';

type PatientSummary = {
  patient: Patient;
  age: number;
  nextAppointments: Appointment[];
  activePrescriptions: Prescription[];
  medications: MedicationWithStock[];
  lowStockCount: number;
};

const DAY_SHORT = ['D', 'L', 'M', 'Me', 'J', 'V', 'S'];

@Component({
  selector: 'app-medical-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, MedicationStockBar, Icon],
  host: { class: 'block space-y-6' },
  template: `
    <header>
      <h2 class="text-2xl font-bold text-text-primary">Vue globale</h2>
      <p class="mt-1 text-sm text-text-muted">Suivi médical familial</p>
    </header>

    <section aria-labelledby="kpi-heading" class="space-y-4">
      <h3 id="kpi-heading" class="sr-only">Indicateurs clés</h3>

      <a routerLink="../medications"
         class="group flex items-center gap-5 rounded-xl border bg-surface px-5 py-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
         [class.border-ib-red-30]="totalLowStock() > 0"
         [class.bg-ib-red-5]="totalLowStock() > 0"
         [class.hover:border-ib-red-50]="totalLowStock() > 0"
         [class.focus-visible:ring-ib-red]="totalLowStock() > 0"
         [class.border-border]="totalLowStock() === 0"
         [class.hover:border-ib-green-30]="totalLowStock() === 0"
         [class.focus-visible:ring-ib-green]="totalLowStock() === 0">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
             [class.bg-ib-red-15]="totalLowStock() > 0"
             [class.bg-ib-green-15]="totalLowStock() === 0">
          <app-icon name="pill" [size]="22"
                    [class.text-ib-red]="totalLowStock() > 0"
                    [class.text-ib-green]="totalLowStock() === 0" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-mono text-xs uppercase tracking-[0.16em] text-text-muted">Alertes stock</p>
          @if (totalLowStock() > 0) {
            <p class="mt-1 text-xl font-semibold tracking-tight text-ib-red">
              {{ totalLowStock() }} médicament{{ totalLowStock() > 1 ? 's' : '' }} en stock bas
            </p>
          } @else {
            <p class="mt-1 text-xl font-semibold tracking-tight text-ib-green">
              Tous les stocks sont OK
            </p>
          }
        </div>
        <app-icon name="arrow-right" [size]="18"
                  class="shrink-0 text-text-muted opacity-60 transition group-hover:translate-x-0.5 group-hover:text-text-primary group-hover:opacity-100" />
      </a>

      <nav class="grid grid-cols-3 gap-3" aria-label="Navigation rapide">
        <a routerLink="../patients"
           class="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition hover:border-ib-purple/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-purple focus-visible:ring-offset-2 focus-visible:ring-offset-canvas">
          <app-icon name="users" [size]="16" class="shrink-0 text-ib-purple" />
          <div class="min-w-0">
            <p class="text-xs text-text-muted">Patients</p>
            <p class="font-mono text-lg font-semibold text-text-primary">{{ patients().length }}</p>
          </div>
        </a>
        <a routerLink="../appointments"
           class="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition hover:border-ib-blue/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas">
          <app-icon name="calendar" [size]="16" class="shrink-0 text-ib-blue" />
          <div class="min-w-0">
            <p class="text-xs text-text-muted">Rendez-vous à venir</p>
            <p class="font-mono text-lg font-semibold text-text-primary">{{ totalUpcomingAppointments() }}</p>
          </div>
        </a>
        <a routerLink="../prescriptions"
           class="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition hover:border-ib-cyan/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-canvas">
          <app-icon name="file-text" [size]="16" class="shrink-0 text-ib-cyan" />
          <div class="min-w-0">
            <p class="text-xs text-text-muted">Ordonnances actives</p>
            <p class="font-mono text-lg font-semibold text-text-primary">{{ totalActivePrescriptions() }}</p>
          </div>
        </a>
      </nav>
    </section>

    <!-- Patient cards -->
    @if (patientSummaries().length > 0) {
      <section aria-labelledby="family-heading">
        <h3 id="family-heading" class="text-lg font-semibold text-text-primary mb-3">Famille</h3>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
          @for (summary of patientSummaries(); track summary.patient.id) {
            <article class="group relative overflow-hidden rounded-xl border bg-surface transition"
                     [class.border-ib-red-30]="summary.lowStockCount > 0"
                     [class.border-border]="summary.lowStockCount === 0"
                     [class.hover:shadow-lg]="true">

              <!-- Header patient -->
              <a routerLink="../patients"
                 class="flex items-center gap-3 px-5 py-4 border-b border-border/50 bg-ib-purple/5 hover:bg-ib-purple/10 transition-colors">
                <div class="flex items-center justify-center w-11 h-11 rounded-full bg-ib-purple/15 text-ib-purple font-bold text-sm ring-2 ring-ib-purple/20">
                  {{ summary.patient.firstName[0] }}{{ summary.patient.lastName[0] }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-semibold text-text-primary truncate">{{ summary.patient.firstName }} {{ summary.patient.lastName }}</p>
                  <p class="text-[11px] text-text-muted">{{ summary.age }} ans — Né(e) le {{ summary.patient.birthDate | date:'d MMMM yyyy' }}</p>
                </div>
                @if (summary.lowStockCount > 0) {
                  <span class="rounded-full px-2 py-0.5 text-[10px] font-medium bg-ib-red/10 text-ib-red shrink-0">
                    {{ summary.lowStockCount }} alerte{{ summary.lowStockCount > 1 ? 's' : '' }}
                  </span>
                }
              </a>

              <div class="p-5 space-y-4">
                @if (summary.patient.notes) {
                  <p class="text-xs text-text-muted italic">{{ summary.patient.notes }}</p>
                }

                <!-- Prochains RDV -->
                <div>
                  <a routerLink="../appointments" class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2 hover:text-ib-blue transition-colors">
                    <app-icon name="calendar" size="12" class="text-ib-blue" /> Prochains rendez-vous
                  </a>
                  @if (summary.nextAppointments.length > 0) {
                    <div class="space-y-1.5">
                      @for (appt of summary.nextAppointments; track appt.id) {
                        <a routerLink="../appointments" class="flex items-center gap-2 rounded-lg bg-ib-blue/5 border border-ib-blue/15 px-3 py-1.5 hover:bg-ib-blue/10 transition-colors">
                          <time class="text-xs font-mono font-medium text-ib-blue" [attr.datetime]="appt.date">
                            {{ appt.date | date:'d MMM' }} à {{ appt.time }}
                          </time>
                          <span class="text-xs text-text-muted">{{ getPractitionerName(appt.practitionerId) }}</span>
                          @if (appt.reason) {
                            <span class="text-xs text-text-muted ml-auto truncate max-w-30">{{ appt.reason }}</span>
                          }
                        </a>
                      }
                    </div>
                  } @else {
                    <p class="text-xs text-text-muted">Aucun rendez-vous à venir</p>
                  }
                </div>

                <!-- Ordonnances actives -->
                <div>
                  <a routerLink="../prescriptions" class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2 hover:text-ib-cyan transition-colors">
                    <app-icon name="file-text" size="12" class="text-ib-cyan" /> Ordonnances actives
                  </a>
                  @if (summary.activePrescriptions.length > 0) {
                    <div class="space-y-1.5">
                      @for (presc of summary.activePrescriptions; track presc.id) {
                        <div class="flex items-center gap-2 rounded-lg bg-ib-cyan/5 border border-ib-cyan/15 px-3 py-1.5">
                          <a routerLink="../prescriptions" class="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                            <span class="text-xs font-mono text-ib-cyan">{{ presc.issuedDate | date:'d MMMM yyyy' }}</span>
                            @if (presc.practitionerId) {
                              <span class="text-xs text-text-muted">{{ getPractitionerName(presc.practitionerId) }}</span>
                            }
                            @if (presc.validUntil) {
                              <span class="text-xs text-text-muted ml-auto">
                                exp. {{ presc.validUntil | date:'d MMM' }}
                              </span>
                            }
                          </a>
                          @if (presc.documentUrl) {
                            <button type="button"
                                    class="shrink-0 rounded-md bg-ib-purple/10 px-2 py-0.5 text-[10px] font-medium text-ib-purple hover:bg-ib-purple/20 transition-colors"
                                    (click)="openDocument(presc.id); $event.preventDefault(); $event.stopPropagation()">
                              Voir PDF
                            </button>
                          }
                        </div>
                      }
                    </div>
                  } @else {
                    <p class="text-xs text-text-muted">Aucune ordonnance active</p>
                  }
                </div>

                <!-- Médicaments -->
                <div>
                  <a routerLink="../medications" class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2 hover:text-ib-orange transition-colors">
                    <app-icon name="pill" size="12" class="text-ib-orange" /> Médicaments
                  </a>
                  @if (summary.medications.length > 0) {
                    <div class="space-y-2">
                      @for (med of summary.medications; track med.id) {
                        <a routerLink="../medications" class="block rounded-lg border px-3 py-2 hover:bg-hover/30 transition-colors"
                             [class.border-ib-red-30]="med.isLow"
                             [class.bg-ib-red-5]="med.isLow"
                             [class.border-border-50]="!med.isLow">
                          <div class="flex items-center justify-between mb-1">
                            <div class="flex items-center gap-2">
                              <span class="text-xs font-medium text-text-primary">{{ med.name }}</span>
                              <span class="text-[10px] text-text-muted">{{ med.dosage }}</span>
                            </div>
                            <span class="text-[10px] font-mono font-medium"
                                  [class.text-ib-red]="med.isLow"
                                  [class.text-ib-green]="!med.isLow">
                              {{ med.daysRemaining }}j
                            </span>
                          </div>
                          <app-medication-stock-bar [daysRemaining]="med.daysRemaining" [alertDaysBefore]="med.alertDaysBefore" />
                          <div class="flex items-center justify-between mt-1">
                            <span class="text-[10px] text-text-muted">{{ med.remainingQuantity }}/{{ med.quantity }} unités — épuisement {{ med.estimatedRunOut | date:'d MMMM yyyy' }}</span>
                            @if (med.skipDays.length > 0) {
                              <div class="flex gap-px">
                                @for (d of dayLabels; track d.idx) {
                                  <span class="text-[8px] w-3 text-center rounded-sm"
                                        [class.bg-ib-purple-20]="med.skipDays.includes(d.idx)"
                                        [class.text-ib-purple]="med.skipDays.includes(d.idx)"
                                        [class.text-text-muted-30]="!med.skipDays.includes(d.idx)">
                                    {{ d.label }}
                                  </span>
                                }
                              </div>
                            }
                          </div>
                        </a>
                      }
                    </div>
                  } @else {
                    <p class="text-xs text-text-muted">Aucun médicament</p>
                  }
                </div>
              </div>
            </article>
          }
        </div>
      </section>
    }
  `,
})
export class MedicalDashboard {
  private readonly prescriptionGateway = inject(PrescriptionGateway);
  private readonly getPatients = inject(GetPatientsUseCase);
  private readonly getPractitioners = inject(GetPractitionersUseCase);
  private readonly getAppointments = inject(GetAppointmentsUseCase);
  private readonly getPrescriptions = inject(GetPrescriptionsUseCase);
  private readonly getMedications = inject(GetMedicationsUseCase);

  protected readonly patients = toSignal(this.getPatients.execute(), { initialValue: [] });
  protected readonly practitioners = toSignal(this.getPractitioners.execute(), { initialValue: [] });
  protected readonly appointments = toSignal(this.getAppointments.execute(), { initialValue: [] });
  protected readonly prescriptions = toSignal(this.getPrescriptions.execute(), { initialValue: [] });
  protected readonly medications = toSignal(this.getMedications.execute(), { initialValue: [] });

  protected readonly dayLabels = DAY_SHORT.map((label, idx) => ({ label, idx }));

  protected readonly medicationsWithStock = computed(() =>
    this.medications().map(m => computeMedicationStock(m))
  );

  private readonly today = new Date().toISOString().slice(0, 10);

  protected readonly patientSummaries = computed((): PatientSummary[] => {
    const allAppointments = this.appointments();
    const allPrescriptions = this.prescriptions();
    const allMeds = this.medicationsWithStock();

    return this.patients().map(patient => {
      const nextAppointments = allAppointments
        .filter(a => a.patientId === patient.id && a.date >= this.today && a.status === 'scheduled')
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
        .slice(0, 3);

      const activePrescriptions = allPrescriptions
        .filter(p => p.patientId === patient.id && (!p.validUntil || p.validUntil >= this.today))
        .sort((a, b) => b.issuedDate.localeCompare(a.issuedDate))
        .slice(0, 3);

      const medications = allMeds
        .filter(m => m.patientId === patient.id)
        .sort((a, b) => a.daysRemaining - b.daysRemaining);

      const age = this.computeAge(patient.birthDate);

      return {
        patient,
        age,
        nextAppointments,
        activePrescriptions,
        medications,
        lowStockCount: medications.filter(m => m.isLow).length,
      };
    });
  });

  protected readonly totalUpcomingAppointments = computed(() =>
    this.patientSummaries().reduce((sum, s) => sum + s.nextAppointments.length, 0)
  );

  protected readonly totalActivePrescriptions = computed(() =>
    this.patientSummaries().reduce((sum, s) => sum + s.activePrescriptions.length, 0)
  );

  protected readonly totalLowStock = computed(() =>
    this.patientSummaries().reduce((sum, s) => sum + s.lowStockCount, 0)
  );

  private readonly practitionerMap = computed(() => {
    const map = new Map<string, string>();
    for (const pr of this.practitioners()) {
      map.set(pr.id, pr.name);
    }
    return map;
  });

  protected getPractitionerName(id: string): string {
    return this.practitionerMap().get(id) ?? 'Inconnu';
  }

  protected async openDocument(id: string) {
    const blob = await lastValueFrom(this.prescriptionGateway.downloadDocument(id));
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  private computeAge(birthDate: string): number {
    const birth = new Date(birthDate);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }
}
