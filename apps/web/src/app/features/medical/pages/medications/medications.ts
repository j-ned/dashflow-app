import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { lastValueFrom, switchMap } from 'rxjs';
import { Medication } from '../../domain/models/medication.model';
import { GetMedicationsUseCase } from '../../domain/use-cases/get-medications.use-case';
import { CreateMedicationUseCase } from '../../domain/use-cases/create-medication.use-case';
import { UpdateMedicationUseCase } from '../../domain/use-cases/update-medication.use-case';
import { RefillMedicationUseCase } from '../../domain/use-cases/refill-medication.use-case';
import { DeleteMedicationUseCase } from '../../domain/use-cases/delete-medication.use-case';
import { GetPatientsUseCase } from '../../domain/use-cases/get-patients.use-case';
import { GetPrescriptionsUseCase } from '../../domain/use-cases/get-prescriptions.use-case';
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

const TYPE_LABELS: Record<string, string> = {
  comprime: 'Comprime',
  gelule: 'Gelule',
  sirop: 'Sirop',
  patch: 'Patch',
  injection: 'Injection',
  gouttes: 'Gouttes',
  creme: 'Creme',
  autre: 'Autre',
};

@Component({
  selector: 'app-medications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalDialog, MedicationForm, RefillMedicationForm, MedicationStockBar, Icon],
  host: { class: 'block space-y-6' },
  template: `
    <header class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">Medicaments</h2>
        <p class="mt-1 text-sm text-text-muted">Suivi des stocks et traitements</p>
      </div>
      <button type="button"
              class="inline-flex items-center gap-1.5 rounded-lg bg-ib-purple px-4 py-2 text-sm font-medium text-white hover:bg-ib-purple/90 transition-colors shadow-sm"
              (click)="openCreateModal()">
        <app-icon name="plus" size="14" /> Ajouter
      </button>
    </header>

    @if (lowStockCount() > 0) {
      <div role="alert" class="flex items-center gap-3 rounded-xl border border-ib-red/30 bg-ib-red/5 p-4">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-ib-red/10 shrink-0">
          <app-icon name="alert-triangle" size="16" class="text-ib-red" />
        </div>
        <p class="text-sm font-medium text-ib-red">{{ lowStockCount() }} medicament{{ lowStockCount() > 1 ? 's' : '' }} en stock bas</p>
      </div>
    }

    <section aria-label="Liste des medicaments" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      @for (med of medicationsWithStock(); track med.id) {
        <article class="group relative overflow-hidden rounded-xl border border-border bg-surface transition-all hover:border-ib-orange/30 hover:shadow-lg hover:shadow-ib-orange/5">
          <div class="absolute inset-y-0 left-0 w-1 rounded-l-xl" [class.bg-ib-red]="med.isLow" [class.bg-ib-orange]="!med.isLow"></div>
          <div class="p-5">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-ib-orange/10">
                <app-icon name="pill" size="16" class="text-ib-orange" />
              </div>
              <h3 class="font-semibold text-text-primary">{{ med.name }}</h3>
            </div>
            <span class="rounded-full px-2 py-0.5 text-xs font-medium bg-ib-purple/10 text-ib-purple">
              {{ typeLabel(med.type) }}
            </span>
          </div>

          <p class="text-sm text-text-muted mb-1">{{ med.dosage }}</p>
          <p class="text-xs text-text-muted mb-2">Patient : <span class="font-medium text-text-primary">{{ patientName(med.patientId) }}</span></p>

          @if (med.skipDays.length > 0) {
            <div class="flex gap-0.5 mb-3">
              @for (day of allDays; track day.value) {
                <span class="flex-1 rounded text-center text-[10px] py-0.5 font-medium"
                      [class.bg-ib-purple-15]="med.skipDays.includes(day.value)"
                      [class.text-ib-purple]="med.skipDays.includes(day.value)"
                      [class.bg-transparent]="!med.skipDays.includes(day.value)"
                      [class.text-text-muted]="!med.skipDays.includes(day.value)">
                  {{ day.label }}
                </span>
              }
            </div>
          }

          <app-medication-stock-bar [daysRemaining]="med.daysRemaining" [alertDaysBefore]="med.alertDaysBefore" />

          <dl class="grid grid-cols-2 gap-2 text-xs mt-3">
            <div>
              <dt class="text-text-muted">Quantite</dt>
              <dd class="font-mono text-text-primary">{{ med.quantity }} unites</dd>
            </div>
            <div>
              <dt class="text-text-muted">Jours restants</dt>
              <dd class="font-mono" [class.text-ib-green]="!med.isLow" [class.text-ib-red]="med.isLow">
                {{ med.daysRemaining }} jours
              </dd>
            </div>
            <div>
              <dt class="text-text-muted">Epuisement estime</dt>
              <dd class="font-mono text-text-primary">{{ med.estimatedRunOut }}</dd>
            </div>
            <div>
              @if (med.isLow) {
                <dt class="sr-only">Alerte</dt>
                <dd>
                  <span class="rounded-full px-2 py-0.5 text-xs font-medium bg-ib-red/10 text-ib-red">
                    Stock bas
                  </span>
                </dd>
              }
            </div>
          </dl>

          <div class="mt-4 flex gap-2 pt-3 border-t border-border/50">
            <button type="button"
                    class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:text-ib-purple hover:border-ib-purple/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-purple"
                    (click)="openRefillModal(med)">
              Reapprovisionner
            </button>
            <button type="button"
                    class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:text-ib-yellow hover:border-ib-yellow/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-yellow"
                    (click)="openEditModal(med)">
              Modifier
            </button>
            <button type="button"
                    class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-red"
                    (click)="deleteMedication(med.id)">
              Supprimer
            </button>
          </div>
          </div>
        </article>
      } @empty {
        <div class="col-span-full text-center py-16 rounded-xl border border-dashed border-border bg-surface">
          <app-icon name="pill" size="48" class="text-text-muted/20 mx-auto mb-3" />
          <p class="text-sm text-text-muted">Aucun medicament</p>
          <p class="text-xs text-text-muted mt-1">Ajoutez vos medicaments pour suivre les stocks</p>
        </div>
      }
    </section>

    <app-modal-dialog #createModal title="Nouveau medicament" (closed)="onModalClosed()">
      <app-medication-form [patients]="patients()" [prescriptions]="prescriptions()" (submitted)="createMedication($event)" (cancelled)="createModal.close()" />
    </app-modal-dialog>

    <app-modal-dialog #editModal title="Modifier le medicament" (closed)="onModalClosed()">
      <app-medication-form [initial]="selectedMedication()" [patients]="patients()" [prescriptions]="prescriptions()" (submitted)="updateMedication($event)" (cancelled)="editModal.close()" />
    </app-modal-dialog>

    <app-modal-dialog #refillModal title="Reapprovisionner" (closed)="onModalClosed()">
      <app-refill-medication-form (submitted)="refillMedication($event)" (cancelled)="refillModal.close()" />
    </app-modal-dialog>
  `,
})
export class Medications {
  private readonly getMedications = inject(GetMedicationsUseCase);
  private readonly createMedicationUC = inject(CreateMedicationUseCase);
  private readonly updateMedicationUC = inject(UpdateMedicationUseCase);
  private readonly refillMedicationUC = inject(RefillMedicationUseCase);
  private readonly deleteMedicationUC = inject(DeleteMedicationUseCase);
  private readonly getPatientsUC = inject(GetPatientsUseCase);
  private readonly getPrescriptionsUC = inject(GetPrescriptionsUseCase);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(ConfirmService);

  private readonly createModalRef = viewChild.required<ModalDialog>('createModal');
  private readonly editModalRef = viewChild.required<ModalDialog>('editModal');
  private readonly refillModalRef = viewChild.required<ModalDialog>('refillModal');

  private readonly _refresh = signal(0);
  private readonly medications = toSignal(
    toObservable(this._refresh).pipe(switchMap(() => this.getMedications.execute())),
    { initialValue: [] },
  );

  protected readonly patients = toSignal(this.getPatientsUC.execute(), { initialValue: [] });
  protected readonly prescriptions = toSignal(this.getPrescriptionsUC.execute(), { initialValue: [] });

  protected readonly medicationsWithStock = computed(() =>
    this.medications().map(med => computeMedicationStock(med))
  );

  protected readonly lowStockCount = computed(() =>
    this.medicationsWithStock().filter(m => m.isLow).length
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
    return this.patientMap().get(id) ?? 'Inconnu';
  }

  protected typeLabel(type: string): string {
    return TYPE_LABELS[type] ?? type;
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
      await lastValueFrom(this.createMedicationUC.execute(data));
      this.toaster.success('Medicament cree');
      this.createModalRef().close();
      this._refresh.update(v => v + 1);
    } catch {
      this.toaster.error('Erreur lors de la creation');
    }
  }

  protected async updateMedication(data: Omit<Medication, 'id'>) {
    const id = this.selectedMedication()?.id;
    if (!id) return;
    try {
      await lastValueFrom(this.updateMedicationUC.execute(id, data));
      this.toaster.success('Medicament modifie');
      this.editModalRef().close();
      this._refresh.update(v => v + 1);
    } catch {
      this.toaster.error('Erreur lors de la modification');
    }
  }

  protected async refillMedication(event: { quantity: number }) {
    const id = this.selectedMedication()?.id;
    if (!id) return;
    try {
      await lastValueFrom(this.refillMedicationUC.execute(id, event.quantity));
      this.toaster.success('Medicament reapprovisionne');
      this.refillModalRef().close();
      this._refresh.update(v => v + 1);
    } catch {
      this.toaster.error('Erreur lors du reapprovisionnement');
    }
  }

  protected async deleteMedication(id: string) {
    if (!await this.confirm.delete('ce medicament')) return;
    try {
      await lastValueFrom(this.deleteMedicationUC.execute(id));
      this.toaster.success('Medicament supprime');
      this._refresh.update(v => v + 1);
    } catch {
      this.toaster.error('Erreur lors de la suppression');
    }
  }
}
