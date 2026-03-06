import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { Envelope } from '../../domain/models/envelope.model';
import { GetEnvelopesUseCase } from '../../domain/use-cases/get-envelopes.use-case';
import { CreateEnvelopeUseCase } from '../../domain/use-cases/create-envelope.use-case';
import { UpdateEnvelopeUseCase } from '../../domain/use-cases/update-envelope.use-case';
import { CreditEnvelopeUseCase } from '../../domain/use-cases/credit-envelope.use-case';
import { DeleteEnvelopeUseCase } from '../../domain/use-cases/delete-envelope.use-case';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { EnvelopeForm } from '../../components/envelope-form/envelope-form';
import { CreditEnvelopeForm } from '../../components/credit-envelope-form/credit-envelope-form';

@Component({
  selector: 'app-envelopes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, ModalDialog, EnvelopeForm, CreditEnvelopeForm],
  host: { class: 'block space-y-6' },
  template: `
    <header class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">Enveloppes</h2>
        <p class="mt-1 text-sm text-text-muted">Gérez vos enveloppes virtuelles</p>
      </div>
      <button type="button"
              class="rounded-lg bg-ib-green px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-green/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-green"
              (click)="openCreateModal()">
        + Nouvelle enveloppe
      </button>
    </header>

    <section aria-label="Liste des enveloppes" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      @for (envelope of envelopes(); track envelope.id) {
        <article class="rounded-xl border border-border bg-surface p-5 hover:border-ib-green/30 transition-colors">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-text-primary">{{ envelope.name }}</h3>
            <span class="rounded-full px-2 py-0.5 text-xs font-medium"
                  [style.background-color]="envelope.color + '20'"
                  [style.color]="envelope.color">
              {{ envelope.type }}
            </span>
          </div>

          <p class="text-3xl font-mono font-semibold text-ib-cyan">{{ envelope.balance | number:'1.2-2' }} &euro;</p>

          @if (envelope.target) {
            @let pct = (envelope.balance / envelope.target) * 100;
            @let remaining = envelope.target - envelope.balance;
            <dl class="grid grid-cols-2 gap-2 text-xs mt-3 mb-3">
              <div>
                <dt class="text-text-muted/70">Objectif</dt>
                <dd class="font-mono text-text-primary">{{ envelope.target | number:'1.2-2' }} &euro;</dd>
              </div>
              <div>
                <dt class="text-text-muted/70">Restant</dt>
                <dd class="font-mono" [class.text-ib-green]="remaining <= 0" [class.text-ib-yellow]="remaining > 0">
                  {{ remaining > 0 ? (remaining | number:'1.2-2') : '0,00' }} &euro;
                </dd>
              </div>
            </dl>
            <div class="flex justify-between text-xs text-text-muted mb-1">
              <span>Progression</span>
              <span class="font-mono">{{ pct | number:'1.0-0' }}%</span>
            </div>
            <div class="h-2 rounded-full bg-hover">
              <div class="h-full rounded-full transition-all duration-300"
                   [style.width.%]="pct > 100 ? 100 : pct"
                   [style.background-color]="envelope.color"></div>
            </div>
          } @else {
            <p class="text-xs text-text-muted mt-2">Aucun objectif défini</p>
          }

          <div class="mt-4 flex gap-2 pt-3 border-t border-border/50">
            <button type="button"
                    class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:text-ib-blue hover:border-ib-blue/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                    (click)="openCreditModal(envelope)">
              +/- Montant
            </button>
            <button type="button"
                    class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:text-ib-yellow hover:border-ib-yellow/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-yellow"
                    (click)="openEditModal(envelope)">
              Modifier
            </button>
            <button type="button"
                    class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-red"
                    (click)="deleteEnvelope(envelope.id)">
              Supprimer
            </button>
          </div>
        </article>
      } @empty {
        <p class="col-span-full text-center text-text-muted py-12">Aucune enveloppe. Créez votre première enveloppe.</p>
      }
    </section>

    <footer class="rounded-xl border border-border bg-surface p-4 flex items-center justify-between">
      <span class="text-sm text-text-muted">Total toutes enveloppes</span>
      <span class="text-xl font-mono font-semibold text-ib-cyan">{{ totalBalance() | number:'1.2-2' }} &euro;</span>
    </footer>

    <app-modal-dialog #createModal title="Nouvelle enveloppe" (closed)="onModalClosed()">
      <app-envelope-form (submitted)="createEnvelope($event)" (cancelled)="createModal.close()" />
    </app-modal-dialog>

    <app-modal-dialog #editModal title="Modifier l'enveloppe" (closed)="onModalClosed()">
      <app-envelope-form [initial]="selectedEnvelope()" (submitted)="updateEnvelope($event)" (cancelled)="editModal.close()" />
    </app-modal-dialog>

    <app-modal-dialog #creditModal title="Créditer / Débiter" (closed)="onModalClosed()">
      <app-credit-envelope-form (submitted)="creditEnvelope($event)" (cancelled)="creditModal.close()" />
    </app-modal-dialog>
  `,
})
export class Envelopes {
  private readonly getEnvelopes = inject(GetEnvelopesUseCase);
  private readonly createEnvelopeUC = inject(CreateEnvelopeUseCase);
  private readonly updateEnvelopeUC = inject(UpdateEnvelopeUseCase);
  private readonly creditEnvelopeUC = inject(CreditEnvelopeUseCase);
  private readonly deleteEnvelopeUC = inject(DeleteEnvelopeUseCase);

  private readonly createModalRef = viewChild.required<ModalDialog>('createModal');
  private readonly editModalRef = viewChild.required<ModalDialog>('editModal');
  private readonly creditModalRef = viewChild.required<ModalDialog>('creditModal');

  private readonly _refresh = signal(0);
  protected readonly envelopes = toSignal(
    toObservable(this._refresh).pipe(switchMap(() => this.getEnvelopes.execute())),
    { initialValue: [] },
  );

  protected readonly totalBalance = computed(() =>
    this.envelopes().reduce((sum, e) => sum + e.balance, 0)
  );

  protected readonly selectedEnvelope = signal<Envelope | null>(null);

  protected openCreateModal() {
    this.createModalRef().open();
  }

  protected openEditModal(envelope: Envelope) {
    this.selectedEnvelope.set(envelope);
    this.editModalRef().open();
  }

  protected openCreditModal(envelope: Envelope) {
    this.selectedEnvelope.set(envelope);
    this.creditModalRef().open();
  }

  protected onModalClosed() {
    this.selectedEnvelope.set(null);
  }

  protected createEnvelope(data: Omit<Envelope, 'id'>) {
    this.createEnvelopeUC.execute(data).subscribe(() => {
      this.createModalRef().close();
      this._refresh.update(v => v + 1);
    });
  }

  protected updateEnvelope(data: Omit<Envelope, 'id'>) {
    const id = this.selectedEnvelope()?.id;
    if (!id) return;
    this.updateEnvelopeUC.execute(id, data).subscribe(() => {
      this.editModalRef().close();
      this._refresh.update(v => v + 1);
    });
  }

  protected creditEnvelope(event: { amount: number }) {
    const id = this.selectedEnvelope()?.id;
    if (!id) return;
    this.creditEnvelopeUC.execute(id, event.amount).subscribe(() => {
      this.creditModalRef().close();
      this._refresh.update(v => v + 1);
    });
  }

  protected deleteEnvelope(id: string) {
    if (!confirm('Supprimer cette enveloppe ?')) return;
    this.deleteEnvelopeUC.execute(id).subscribe(() => {
      this._refresh.update(v => v + 1);
    });
  }
}
