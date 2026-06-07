import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { lastValueFrom, switchMap } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Medication } from '../../domain/models/medication.model';
import { MedicationGateway } from '../../domain/gateways/medication.gateway';
import { PatientGateway } from '../../domain/gateways/patient.gateway';
import { PrescriptionGateway } from '../../domain/gateways/prescription.gateway';
import { computeMedicationStock } from '../../domain/medication-calculator';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { Icon } from '@shared/components/icon/icon';
import { MedicationForm } from '../../components/medication-form/medication-form';
import { RefillMedicationForm } from '../../components/refill-medication-form/refill-medication-form';
import { MedicationStockBar } from '../../components/medication-stock-bar/medication-stock-bar';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';

const DAY_LABELS = [
  { value: 0, label: 'D' },
  { value: 1, label: 'L' },
  { value: 2, label: 'M' },
  { value: 3, label: 'Me' },
  { value: 4, label: 'J' },
  { value: 5, label: 'V' },
  { value: 6, label: 'S' },
];

@Component({
  selector: 'app-medications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalDialog,
    MedicationForm,
    RefillMedicationForm,
    MedicationStockBar,
    Icon,
    TranslocoPipe,
  ],
  host: { class: 'block space-y-6' },
  template: `
    <header class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">
          {{ 'medical.medication.title' | transloco }}
        </h2>
        <p class="mt-1 text-sm text-text-muted">{{ 'medical.medication.subtitle' | transloco }}</p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg bg-ib-purple px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-purple/90 transition-colors shadow-sm"
        (click)="openCreateModal()"
      >
        <app-icon name="plus" size="14" /> {{ 'medical.medication.create' | transloco }}
      </button>
    </header>

    @if (lowStockCount() > 0) {
      <div
        role="alert"
        class="flex items-center gap-3 rounded-xl border border-ib-red/30 bg-ib-red/5 p-4"
      >
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-ib-red/10 shrink-0">
          <app-icon name="alert-triangle" size="16" class="text-ib-red" />
        </div>
        <p class="text-sm font-medium text-ib-red">
          @if (lowStockCount() === 1) {
            {{ 'medical.medication.lowStockBannerOne' | transloco: { count: lowStockCount() } }}
          } @else {
            {{ 'medical.medication.lowStockBannerMany' | transloco: { count: lowStockCount() } }}
          }
        </p>
      </div>
    }

    <section
      [attr.aria-label]="'medical.medication.listLabel' | transloco"
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      @for (med of medicationsWithStock(); track med.id) {
        <article
          class="group relative overflow-hidden rounded-xl border border-border bg-surface transition hover:border-ib-orange/30 hover:shadow-lg hover:shadow-ib-orange/5"
        >
          <div class="p-5">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-ib-orange/10">
                  <app-icon name="pill" size="16" class="text-ib-orange" />
                </div>
                <h3 class="font-semibold text-text-primary">{{ med.name }}</h3>
              </div>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium bg-ib-purple/10 text-ib-purple"
              >
                {{ 'medical.medication.types.' + med.type | transloco }}
              </span>
            </div>

            <p class="text-sm text-text-muted mb-1">{{ med.dosage }}</p>
            <p class="text-xs text-text-muted mb-2">
              {{ 'medical.medication.patientLabel' | transloco }} :
              <span class="font-medium text-text-primary">{{ patientName(med.patientId) }}</span>
            </p>

            @if (med.skipDays.length > 0) {
              <div class="flex gap-0.5 mb-3">
                @for (day of allDays; track day.value) {
                  <span
                    class="flex-1 rounded text-center text-[10px] py-0.5 font-medium"
                    [class.bg-ib-purple-15]="med.skipDays.includes(day.value)"
                    [class.text-ib-purple]="med.skipDays.includes(day.value)"
                    [class.bg-transparent]="!med.skipDays.includes(day.value)"
                    [class.text-text-muted]="!med.skipDays.includes(day.value)"
                  >
                    {{ day.label }}
                  </span>
                }
              </div>
            }

            <app-medication-stock-bar
              [daysRemaining]="med.daysRemaining"
              [alertDaysBefore]="med.alertDaysBefore"
            />

            <dl class="grid grid-cols-2 gap-2 text-xs mt-3">
              <div>
                <dt class="text-text-muted">
                  {{ 'medical.medication.stockRemaining' | transloco }}
                </dt>
                <dd
                  class="font-mono font-medium"
                  [class.text-ib-green]="!med.isLow"
                  [class.text-ib-red]="med.isLow"
                >
                  {{
                    'medical.medication.stockUnits'
                      | transloco: { remaining: med.remainingQuantity, total: med.quantity }
                  }}
                </dd>
              </div>
              <div>
                <dt class="text-text-muted">{{ 'medical.medication.consumed' | transloco }}</dt>
                <dd class="font-mono text-ib-orange">
                  {{
                    'medical.medication.consumedUnits' | transloco: { value: med.consumedQuantity }
                  }}
                </dd>
              </div>
              <div>
                <dt class="text-text-muted">
                  {{ 'medical.medication.takeDaysRemaining' | transloco }}
                </dt>
                <dd class="font-mono text-ib-green">
                  {{ 'medical.medication.daysShort' | transloco: { days: med.takeDaysRemaining } }}
                </dd>
              </div>
              <div>
                <dt class="text-text-muted">
                  {{ 'medical.medication.restDaysRemaining' | transloco }}
                </dt>
                <dd class="font-mono text-text-muted">
                  {{ 'medical.medication.daysShort' | transloco: { days: med.restDaysRemaining } }}
                </dd>
              </div>
              <div>
                <dt class="text-text-muted">
                  {{ 'medical.medication.estimatedRunOut' | transloco }}
                </dt>
                <dd class="font-mono text-text-primary">{{ med.estimatedRunOut }}</dd>
              </div>
              <div>
                @if (med.isLow) {
                  <dt class="sr-only">{{ 'medical.medication.alert' | transloco }}</dt>
                  <dd>
                    <span
                      class="rounded-full px-2 py-0.5 text-xs font-medium bg-ib-red/10 text-ib-red"
                    >
                      {{ 'medical.medication.lowStock' | transloco }}
                    </span>
                  </dd>
                }
              </div>
            </dl>

            <div class="mt-4 flex gap-2 pt-3 border-t border-border/50">
              <button
                type="button"
                class="rounded-lg border border-border px-3 py-1.5 text-xs min-h-8 font-medium text-text-muted hover:text-ib-purple hover:border-ib-purple/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-purple"
                (click)="openRefillModal(med)"
              >
                {{ 'medical.medication.refill' | transloco }}
              </button>
              <button
                type="button"
                class="rounded-lg border border-border px-3 py-1.5 text-xs min-h-8 font-medium text-text-muted hover:text-ib-yellow hover:border-ib-yellow/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-yellow"
                (click)="openEditModal(med)"
              >
                {{ 'common.edit' | transloco }}
              </button>
              <button
                type="button"
                class="rounded-lg border border-border px-3 py-1.5 text-xs min-h-8 font-medium text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-red"
                (click)="deleteMedication(med.id)"
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
          <app-icon name="pill" size="48" class="text-text-muted/20 mx-auto mb-3" />
          <p class="text-sm text-text-muted">{{ 'medical.medication.empty' | transloco }}</p>
          <p class="text-xs text-text-muted mt-1">
            {{ 'medical.medication.emptyHint' | transloco }}
          </p>
        </div>
      }
    </section>

    <app-modal-dialog
      #createModal
      [title]="'medical.medication.modalCreateTitle' | transloco"
      (closed)="onModalClosed()"
    >
      @if (createModal.isOpen()) {
        <app-medication-form
          [patients]="patients()"
          [prescriptions]="prescriptions()"
          (submitted)="createMedication($event)"
          (cancelled)="createModal.close()"
        />
      }
    </app-modal-dialog>

    <app-modal-dialog
      #editModal
      [title]="'medical.medication.modalEditTitle' | transloco"
      (closed)="onModalClosed()"
    >
      @if (editModal.isOpen()) {
        <app-medication-form
          [initial]="selectedMedication()"
          [patients]="patients()"
          [prescriptions]="prescriptions()"
          (submitted)="updateMedication($event)"
          (cancelled)="editModal.close()"
        />
      }
    </app-modal-dialog>

    <app-modal-dialog
      #refillModal
      [title]="'medical.medication.modalRefillTitle' | transloco"
      (closed)="onModalClosed()"
    >
      @if (refillModal.isOpen()) {
        <app-refill-medication-form
          (submitted)="refillMedication($event)"
          (cancelled)="refillModal.close()"
        />
      }
    </app-modal-dialog>
  `,
})
export class Medications {
  private readonly medicationGw = inject(MedicationGateway);
  private readonly patientGw = inject(PatientGateway);
  private readonly prescriptionGw = inject(PrescriptionGateway);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(ConfirmService);
  private readonly _i18n = inject(TranslocoService);

  private readonly createModalRef = viewChild.required<ModalDialog>('createModal');
  private readonly editModalRef = viewChild.required<ModalDialog>('editModal');
  private readonly refillModalRef = viewChild.required<ModalDialog>('refillModal');

  private readonly _refresh = signal(0);
  private readonly medications = toSignal(
    toObservable(this._refresh).pipe(switchMap(() => this.medicationGw.getAll())),
    { initialValue: [] },
  );

  protected readonly patients = toSignal(this.patientGw.getAll(), { initialValue: [] });
  protected readonly prescriptions = toSignal(this.prescriptionGw.getAll(), { initialValue: [] });

  protected readonly medicationsWithStock = computed(() =>
    this.medications().map((med) => computeMedicationStock(med)),
  );

  protected readonly lowStockCount = computed(
    () => this.medicationsWithStock().filter((m) => m.isLow).length,
  );

  protected readonly allDays = DAY_LABELS;
  protected readonly selectedMedication = signal<Medication | null>(null);

  private readonly patientMap = computed(() => {
    const map = new Map<string, string>();
    for (const p of this.patients()) {
      map.set(p.id, `${p.firstName} ${p.lastName}`);
    }
    return map;
  });

  protected patientName(id: string): string {
    return this.patientMap().get(id) ?? this._i18n.translate('medical.medication.unknownPatient');
  }

  protected openCreateModal() {
    this.createModalRef().open();
  }

  protected openEditModal(item: Medication) {
    this.selectedMedication.set(item);
    this.editModalRef().open();
  }

  protected openRefillModal(item: Medication) {
    this.selectedMedication.set(item);
    this.refillModalRef().open();
  }

  protected onModalClosed() {
    this.selectedMedication.set(null);
  }

  protected async createMedication(data: Omit<Medication, 'id'>) {
    try {
      await lastValueFrom(this.medicationGw.create(data));
      this.toaster.success('medical.medication.feedback.created');
      this.createModalRef().close();
      this._refresh.update((v) => v + 1);
    } catch {
      this.toaster.error('medical.medication.feedback.createFailed');
    }
  }

  protected async updateMedication(data: Omit<Medication, 'id'>) {
    const id = this.selectedMedication()?.id;
    if (!id) return;
    try {
      await lastValueFrom(this.medicationGw.update(id, data));
      this.toaster.success('medical.medication.feedback.updated');
      this.editModalRef().close();
      this._refresh.update((v) => v + 1);
    } catch {
      this.toaster.error('medical.medication.feedback.updateFailed');
    }
  }

  protected async refillMedication(event: { quantity: number }) {
    const id = this.selectedMedication()?.id;
    if (!id) return;
    try {
      await lastValueFrom(this.medicationGw.refill(id, event.quantity));
      this.toaster.success('medical.medication.feedback.refilled');
      this.refillModalRef().close();
      this._refresh.update((v) => v + 1);
    } catch {
      this.toaster.error('medical.medication.feedback.refillFailed');
    }
  }

  protected async deleteMedication(id: string) {
    if (!(await this.confirm.delete(this._i18n.translate('medical.medication.deleteEntityName'))))
      return;
    try {
      await lastValueFrom(this.medicationGw.delete(id));
      this.toaster.success('medical.medication.feedback.deleted');
      this._refresh.update((v) => v + 1);
    } catch {
      this.toaster.error('medical.medication.feedback.deleteFailed');
    }
  }
}
