import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { lastValueFrom, switchMap } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Practitioner } from '../../domain/models/practitioner.model';
import { GetPractitionersUseCase } from '../../domain/use-cases/get-practitioners.use-case';
import { CreatePractitionerUseCase } from '../../domain/use-cases/create-practitioner.use-case';
import { UpdatePractitionerUseCase } from '../../domain/use-cases/update-practitioner.use-case';
import { DeletePractitionerUseCase } from '../../domain/use-cases/delete-practitioner.use-case';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { PractitionerForm } from '../../components/practitioner-form/practitioner-form';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { Icon } from '@shared/components/icon/icon';

@Component({
  selector: 'app-practitioners',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalDialog, PractitionerForm, Icon, TranslocoPipe],
  host: { class: 'block space-y-6' },
  template: `
    <header class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">{{ 'medical.practitioner.title' | transloco }}</h2>
        <p class="mt-1 text-sm text-text-muted">{{ 'medical.practitioner.subtitle' | transloco }}</p>
      </div>
      <button type="button"
              class="inline-flex items-center gap-1.5 rounded-lg bg-ib-purple px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-purple/90 transition-colors shadow-sm"
              (click)="openCreateModal()">
        <app-icon name="plus" size="14" /> {{ 'medical.practitioner.create' | transloco }}
      </button>
    </header>

    <section [attr.aria-label]="'medical.practitioner.listLabel' | transloco" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      @for (practitioner of practitioners(); track practitioner.id) {
        <article class="group relative overflow-hidden rounded-xl border border-border bg-surface transition hover:border-ib-blue/30 hover:shadow-lg hover:shadow-ib-blue/5">
          <div class="p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-ib-blue/10">
                <app-icon name="stethoscope" size="16" class="text-ib-blue" />
              </div>
              <h3 class="font-semibold text-text-primary">{{ practitioner.name }}</h3>
            </div>
            <span class="rounded-full bg-ib-purple/15 px-2 py-0.5 text-xs font-medium text-ib-purple">
              {{ ('medical.practitioner.types.' + practitioner.type) | transloco }}
            </span>
          </div>

          <dl class="ml-10 grid grid-cols-1 gap-1 text-sm">
            @if (practitioner.phone) {
              <div>
                <dt class="text-text-muted text-xs">{{ 'medical.practitioner.phone' | transloco }}</dt>
                <dd class="text-text-primary">{{ practitioner.phone }}</dd>
              </div>
            }
            @if (practitioner.email) {
              <div>
                <dt class="text-text-muted text-xs">{{ 'medical.practitioner.email' | transloco }}</dt>
                <dd class="text-text-primary text-xs">{{ practitioner.email }}</dd>
              </div>
            }
            @if (practitioner.address) {
              <div class="mt-1">
                <dt class="text-text-muted text-xs">{{ 'medical.practitioner.address' | transloco }}</dt>
                <dd class="text-text-primary text-xs line-clamp-2">{{ practitioner.address }}</dd>
              </div>
            }
            @if (practitioner.bookingUrl) {
              <div class="mt-1">
                <dt class="text-text-muted text-xs">{{ 'medical.practitioner.bookingLabel' | transloco }}</dt>
                <dd>
                  <a [href]="practitioner.bookingUrl" target="_blank" rel="noopener"
                     class="text-xs text-ib-purple hover:underline">{{ 'medical.practitioner.bookAppointment' | transloco }}</a>
                </dd>
              </div>
            }
          </dl>

          <div class="mt-4 flex gap-2 pt-3 border-t border-border/50">
            <button type="button"
                    class="rounded-lg border border-border px-3 py-1.5 text-xs min-h-8 font-medium text-text-muted hover:text-ib-yellow hover:border-ib-yellow/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-yellow"
                    (click)="openEditModal(practitioner)">
              {{ 'common.edit' | transloco }}
            </button>
            <button type="button"
                    class="rounded-lg border border-border px-3 py-1.5 text-xs min-h-8 font-medium text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-red"
                    (click)="deletePractitioner(practitioner.id)">
              {{ 'common.delete' | transloco }}
            </button>
          </div>
          </div>
        </article>
      } @empty {
        <div class="col-span-full text-center py-16 rounded-xl border border-dashed border-border bg-surface">
          <app-icon name="stethoscope" size="48" class="text-text-muted/20 mx-auto mb-3" />
          <p class="text-sm text-text-muted">{{ 'medical.practitioner.empty' | transloco }}</p>
          <p class="text-xs text-text-muted mt-1">{{ 'medical.practitioner.emptyHint' | transloco }}</p>
        </div>
      }
    </section>

    <app-modal-dialog #createModal [title]="'medical.practitioner.modalCreateTitle' | transloco" (closed)="onModalClosed()">
      @if (createModal.isOpen()) {
        <app-practitioner-form (submitted)="createPractitioner($event)" (cancelled)="createModal.close()" />
      }
    </app-modal-dialog>

    <app-modal-dialog #editModal [title]="'medical.practitioner.modalEditTitle' | transloco" (closed)="onModalClosed()">
      @if (editModal.isOpen()) {
        <app-practitioner-form [initial]="selectedPractitioner()" (submitted)="updatePractitioner($event)" (cancelled)="editModal.close()" />
      }
    </app-modal-dialog>
  `,
})
export class Practitioners {
  private readonly getPractitioners = inject(GetPractitionersUseCase);
  private readonly createPractitionerUC = inject(CreatePractitionerUseCase);
  private readonly updatePractitionerUC = inject(UpdatePractitionerUseCase);
  private readonly deletePractitionerUC = inject(DeletePractitionerUseCase);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(ConfirmService);
  private readonly _i18n = inject(TranslocoService);

  private readonly createModalRef = viewChild.required<ModalDialog>('createModal');
  private readonly editModalRef = viewChild.required<ModalDialog>('editModal');

  private readonly _refresh = signal(0);
  protected readonly practitioners = toSignal(
    toObservable(this._refresh).pipe(switchMap(() => this.getPractitioners.execute())),
    { initialValue: [] },
  );

  protected readonly selectedPractitioner = signal<Practitioner | null>(null);

  protected openCreateModal() {
    this.createModalRef().open();
  }

  protected openEditModal(practitioner: Practitioner) {
    this.selectedPractitioner.set(practitioner);
    this.editModalRef().open();
  }

  protected onModalClosed() {
    this.selectedPractitioner.set(null);
  }

  protected async createPractitioner(data: Omit<Practitioner, 'id'>) {
    try {
      await lastValueFrom(this.createPractitionerUC.execute(data));
      this.toaster.success('medical.practitioner.feedback.created');
      this.createModalRef().close();
      this._refresh.update(v => v + 1);
    } catch {
      this.toaster.error('medical.practitioner.feedback.createFailed');
    }
  }

  protected async updatePractitioner(data: Omit<Practitioner, 'id'>) {
    const id = this.selectedPractitioner()?.id;
    if (!id) return;
    try {
      await lastValueFrom(this.updatePractitionerUC.execute(id, data));
      this.toaster.success('medical.practitioner.feedback.updated');
      this.editModalRef().close();
      this._refresh.update(v => v + 1);
    } catch {
      this.toaster.error('medical.practitioner.feedback.updateFailed');
    }
  }

  protected async deletePractitioner(id: string) {
    if (!await this.confirm.delete(this._i18n.translate('medical.practitioner.deleteEntityName'))) return;
    try {
      await lastValueFrom(this.deletePractitionerUC.execute(id));
      this.toaster.success('medical.practitioner.feedback.deleted');
      this._refresh.update(v => v + 1);
    } catch {
      this.toaster.error('medical.practitioner.feedback.deleteFailed');
    }
  }
}
