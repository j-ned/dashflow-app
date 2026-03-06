import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { Consumable } from '../../domain/models/consumable.model';
import { GetConsumablesUseCase } from '../../domain/use-cases/get-consumables.use-case';
import { CreateConsumableUseCase } from '../../domain/use-cases/create-consumable.use-case';
import { UpdateConsumableUseCase } from '../../domain/use-cases/update-consumable.use-case';
import { InstallConsumableUseCase } from '../../domain/use-cases/install-consumable.use-case';
import { DeleteConsumableUseCase } from '../../domain/use-cases/delete-consumable.use-case';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { ConsumableForm } from '../../components/consumable-form/consumable-form';
import { InstallConsumableForm } from '../../components/install-consumable-form/install-consumable-form';
import { LifetimePercentPipe } from '@shared/pipes/lifetime-percent/lifetime-percent';

@Component({
  selector: 'app-consumables',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, ModalDialog, ConsumableForm, InstallConsumableForm, LifetimePercentPipe],
  host: { class: 'block space-y-6' },
  template: `
    <header class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">Consommables</h2>
        <p class="mt-1 text-sm text-text-muted">Stock de consommables imprimante</p>
      </div>
      <button type="button"
              class="rounded-lg bg-ib-green px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-green/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-green"
              (click)="openCreateModal()">
        + Ajouter
      </button>
    </header>

    @if (lowStockCount() > 0) {
      <div role="alert" class="rounded-lg border border-ib-orange/30 bg-ib-orange/10 p-3 text-sm text-ib-orange">
        {{ lowStockCount() }} consommable(s) en stock bas
      </div>
    }

    <section aria-label="Liste des consommables">
      <table class="w-full text-left">
        <thead>
          <tr class="border-b border-border text-sm text-text-muted">
            <th class="pb-3 font-medium">Nom</th>
            <th class="pb-3 font-medium">Catégorie</th>
            <th class="pb-3 font-medium text-right">Quantité</th>
            <th class="pb-3 font-medium text-right">Seuil min</th>
            <th class="pb-3 font-medium text-right">Prix unitaire</th>
            <th class="pb-3 font-medium">Vie restante</th>
            <th class="pb-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (item of consumables(); track item.id) {
            @let lifetime = item.installedAt | lifetimePercent:item.estimatedLifetimeDays;
            <tr class="border-b border-border/50 hover:bg-hover/50 transition-colors">
              <td class="py-3 font-medium text-text-primary">{{ item.name }}</td>
              <td class="py-3">
                <span class="rounded-full px-2 py-0.5 text-xs font-medium bg-raised text-text-muted">{{ item.category }}</span>
              </td>
              <td class="py-3 text-right font-mono"
                  [class.text-ib-red]="item.quantity <= item.minThreshold"
                  [class.text-ib-green]="item.quantity > item.minThreshold">
                {{ item.quantity }}
              </td>
              <td class="py-3 text-right font-mono text-text-muted">{{ item.minThreshold }}</td>
              <td class="py-3 text-right font-mono text-ib-cyan">{{ item.unitPrice | number:'1.2-2' }} &euro;</td>
              <td class="py-3">
                @if (lifetime !== null) {
                  <div class="flex items-center gap-2">
                    <div class="h-2 w-20 rounded-full bg-hover">
                      <div class="h-full rounded-full transition-all duration-300"
                           [style.width.%]="lifetime"
                           [class.bg-ib-green]="lifetime > 30"
                           [class.bg-ib-orange]="lifetime > 10 && lifetime <= 30"
                           [class.bg-ib-red]="lifetime <= 10"></div>
                    </div>
                    <span class="text-xs font-mono"
                          [class.text-ib-green]="lifetime > 30"
                          [class.text-ib-orange]="lifetime > 10 && lifetime <= 30"
                          [class.text-ib-red]="lifetime <= 10">
                      {{ lifetime }}%
                    </span>
                  </div>
                } @else {
                  <span class="text-xs text-text-muted">—</span>
                }
              </td>
              <td class="py-3 text-right">
                <div class="flex justify-end gap-2">
                  <button type="button"
                          class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:text-ib-cyan hover:border-ib-cyan/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-cyan"
                          (click)="openInstallModal(item)">
                    Installer
                  </button>
                  <button type="button"
                          class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:text-ib-yellow hover:border-ib-yellow/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-yellow"
                          (click)="openEditModal(item)">
                    Modifier
                  </button>
                  <button type="button"
                          class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-red"
                          (click)="deleteConsumable(item.id)">
                    Supprimer
                  </button>
                </div>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="7" class="py-12 text-center text-text-muted">Aucun consommable enregistré</td>
            </tr>
          }
        </tbody>
      </table>
    </section>

    <app-modal-dialog #createModal title="Nouveau consommable" (closed)="onModalClosed()">
      <app-consumable-form (submitted)="createConsumable($event)" (cancelled)="createModal.close()" />
    </app-modal-dialog>

    <app-modal-dialog #editModal title="Modifier le consommable" (closed)="onModalClosed()">
      <app-consumable-form [initial]="selectedConsumable()" (submitted)="updateConsumable($event)" (cancelled)="editModal.close()" />
    </app-modal-dialog>

    <app-modal-dialog #installModal title="Installer le consommable" (closed)="onModalClosed()">
      <app-install-consumable-form (submitted)="installConsumable($event)" (cancelled)="installModal.close()" />
    </app-modal-dialog>
  `,
})
export class Consumables {
  private readonly getConsumables = inject(GetConsumablesUseCase);
  private readonly createConsumableUC = inject(CreateConsumableUseCase);
  private readonly updateConsumableUC = inject(UpdateConsumableUseCase);
  private readonly installConsumableUC = inject(InstallConsumableUseCase);
  private readonly deleteConsumableUC = inject(DeleteConsumableUseCase);

  private readonly createModalRef = viewChild.required<ModalDialog>('createModal');
  private readonly editModalRef = viewChild.required<ModalDialog>('editModal');
  private readonly installModalRef = viewChild.required<ModalDialog>('installModal');

  private readonly _refresh = signal(0);
  protected readonly consumables = toSignal(
    toObservable(this._refresh).pipe(switchMap(() => this.getConsumables.execute())),
    { initialValue: [] },
  );

  protected readonly lowStockCount = computed(() =>
    this.consumables().filter(c => c.quantity <= c.minThreshold).length
  );

  protected readonly selectedConsumable = signal<Consumable | null>(null);

  protected openCreateModal() {
    this.createModalRef().open();
  }

  protected openEditModal(item: Consumable) {
    this.selectedConsumable.set(item);
    this.editModalRef().open();
  }

  protected openInstallModal(item: Consumable) {
    this.selectedConsumable.set(item);
    this.installModalRef().open();
  }

  protected onModalClosed() {
    this.selectedConsumable.set(null);
  }

  protected createConsumable(data: Omit<Consumable, 'id'>) {
    this.createConsumableUC.execute(data).subscribe(() => {
      this.createModalRef().close();
      this._refresh.update(v => v + 1);
    });
  }

  protected updateConsumable(data: Omit<Consumable, 'id'>) {
    const id = this.selectedConsumable()?.id;
    if (!id) return;
    this.updateConsumableUC.execute(id, data).subscribe(() => {
      this.editModalRef().close();
      this._refresh.update(v => v + 1);
    });
  }

  protected installConsumable(event: { installedAt: string; estimatedLifetimeDays: number }) {
    const id = this.selectedConsumable()?.id;
    if (!id) return;
    this.installConsumableUC.execute(id, event.installedAt, event.estimatedLifetimeDays).subscribe(() => {
      this.installModalRef().close();
      this._refresh.update(v => v + 1);
    });
  }

  protected deleteConsumable(id: string) {
    if (!confirm('Supprimer ce consommable ?')) return;
    this.deleteConsumableUC.execute(id).subscribe(() => {
      this._refresh.update(v => v + 1);
    });
  }
}
